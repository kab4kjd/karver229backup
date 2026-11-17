import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Get the JWT token from the request
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "No authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify the user making the request (use getClaims for local JWT verification)
    const token = authHeader.replace("Bearer ", "");
    const supabaseClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });

    // Verify the user making the request using admin auth getUser
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);
    if (userError || !user) {
      console.error("Auth verification failed:", userError);
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check if user is admin
    const { data: roleData } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!roleData || roleData.role !== "admin") {
      return new Response(JSON.stringify({ error: "Admin access required" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { action, ...params } = await req.json();

    switch (action) {
      case "list": {
        // Get all auth users
        const { data: { users }, error } = await supabaseAdmin.auth.admin.listUsers();
        if (error) throw error;

        // Get profiles, roles, and permissions
        const { data: profiles } = await supabaseAdmin.from("profiles").select("user_id, username, display_name");
        const { data: roles } = await supabaseAdmin.from("user_roles").select("user_id, role");
        const { data: permissions } = await supabaseAdmin.from("user_permissions").select("*");

        const usersWithRoles = users.map((u) => {
          const profile = profiles?.find((p) => p.user_id === u.id);
          const userRole = roles?.find((r) => r.user_id === u.id);
          const userPermissions = permissions?.find((p) => p.user_id === u.id);
          return {
            id: u.id,
            username: profile?.username || "unknown",
            display_name: profile?.display_name || "",
            role: userRole?.role || null,
            created_at: u.created_at,
            permissions: userPermissions || null,
          };
        });

        return new Response(JSON.stringify({ users: usersWithRoles }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "create": {
        const { username, password, role } = params;
        
        if (!username || !password || !role) {
          return new Response(JSON.stringify({ error: "Missing required fields" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        if (!password) {
          return new Response(JSON.stringify({ error: "Missing password" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const authPassword = password.length < 6 ? password.padEnd(6, password) : password;
        const email = `${username}@karaoke.local`;

        // Create auth user
        const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
          email,
          password: authPassword,
          email_confirm: true,
          user_metadata: { username },
        });

        if (authError) {
          return new Response(JSON.stringify({ error: authError.message }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // Create profile (no DB trigger exists)
        const { error: profileError } = await supabaseAdmin
          .from("profiles")
          .insert({ user_id: authData.user.id, username, display_name: username });

        if (profileError) {
          await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
          return new Response(JSON.stringify({ error: profileError.message }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // Assign role
        const { error: roleError } = await supabaseAdmin
          .from("user_roles")
          .insert({ user_id: authData.user.id, role });

        if (roleError) {
          // Rollback
          await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
          return new Response(JSON.stringify({ error: roleError.message }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // Create default permissions based on role
        const defaultPermissions = role === "admin"
          ? {
              can_view_history: true,
              can_delete_history: true,
              can_view_reports: true,
              can_view_inventory: true,
              can_edit_inventory_history: true,
              can_delete_inventory_history: true,
              can_view_config: true,
              can_view_logs: true,
              can_delete_logs: true,
              can_view_expenses: true,
              can_view_customers: true,
              can_delete_customers: true,
              edit_invoice_minutes: 0,
              can_config_rooms: true,
              can_config_items: true,
              can_config_pricelist: true,
              can_config_layout: true,
              can_config_print: true,
            }
          : {
              can_view_history: true,
              can_delete_history: false,
              can_view_reports: false,
              can_view_inventory: false,
              can_edit_inventory_history: false,
              can_delete_inventory_history: false,
              can_view_config: false,
              can_view_logs: false,
              can_delete_logs: false,
              can_view_expenses: false,
              can_view_customers: false,
              can_delete_customers: false,
              edit_invoice_minutes: 60,
              can_config_rooms: true,
              can_config_items: true,
              can_config_pricelist: false,
              can_config_layout: false,
              can_config_print: false,
            };

        await supabaseAdmin
          .from("user_permissions")
          .insert({ user_id: authData.user.id, ...defaultPermissions });

        return new Response(JSON.stringify({ user: authData.user }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "updateRole": {
        const { userId, role } = params;
        
        // Check if role already exists
        const { data: existingRole } = await supabaseAdmin
          .from("user_roles")
          .select("id")
          .eq("user_id", userId)
          .maybeSingle();

        if (existingRole) {
          const { error } = await supabaseAdmin
            .from("user_roles")
            .update({ role })
            .eq("user_id", userId);
          if (error) throw error;
        } else {
          const { error } = await supabaseAdmin
            .from("user_roles")
            .insert({ user_id: userId, role });
          if (error) throw error;
        }

        // If role is admin, update permissions to full access
        if (role === "admin") {
          const { data: existingPerms } = await supabaseAdmin
            .from("user_permissions")
            .select("id")
            .eq("user_id", userId)
            .maybeSingle();

          const adminPermissions = {
            can_view_history: true,
            can_delete_history: true,
            can_view_reports: true,
            can_view_inventory: true,
            can_edit_inventory_history: true,
            can_delete_inventory_history: true,
            can_view_config: true,
            can_view_logs: true,
            can_delete_logs: true,
            can_view_expenses: true,
            can_view_customers: true,
            can_delete_customers: true,
            can_config_rooms: true,
            can_config_items: true,
            can_config_pricelist: true,
            can_config_layout: true,
            can_config_print: true,
          };

          if (existingPerms) {
            await supabaseAdmin
              .from("user_permissions")
              .update(adminPermissions)
              .eq("user_id", userId);
          } else {
            await supabaseAdmin
              .from("user_permissions")
              .insert({ user_id: userId, ...adminPermissions });
          }
        }

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "updatePermissions": {
        const { userId, permissions } = params;

        // Check if permissions already exist
        const { data: existingPerms } = await supabaseAdmin
          .from("user_permissions")
          .select("id")
          .eq("user_id", userId)
          .maybeSingle();

        if (existingPerms) {
          const { error } = await supabaseAdmin
            .from("user_permissions")
            .update(permissions)
            .eq("user_id", userId);
          if (error) throw error;
        } else {
          const { error } = await supabaseAdmin
            .from("user_permissions")
            .insert({ user_id: userId, ...permissions });
          if (error) throw error;
        }

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "delete": {
        const { userId } = params;

        // Prevent self-deletion
        if (userId === user.id) {
          return new Response(JSON.stringify({ error: "Cannot delete yourself" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);
        if (error) throw error;

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "updatePassword": {
        const { userId, password } = params;

        if (!userId || !password) {
          return new Response(JSON.stringify({ error: "Missing required fields" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const authPassword = password.length < 6 ? password.padEnd(6, password) : password;

        const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, {
          password: authPassword,
        });

        if (error) {
          return new Response(JSON.stringify({ error: error.message }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "updateDisplayName": {
        const { userId: dnUserId, displayName } = params;

        if (!dnUserId) {
          return new Response(JSON.stringify({ error: "Missing userId" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const { error: dnError } = await supabaseAdmin
          .from("profiles")
          .update({ display_name: displayName || null })
          .eq("user_id", dnUserId);

        if (dnError) {
          return new Response(JSON.stringify({ error: dnError.message }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      default:
        return new Response(JSON.stringify({ error: "Invalid action" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }
  } catch (error) {
    console.error("Error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
