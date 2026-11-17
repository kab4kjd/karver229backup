import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';
import { brokeredPreviewStorage } from './previewAuthStorage';
import {
  getActiveDatabaseConfig,
  isOldDatabase,
  isValidHttpUrl,
  getDatabaseStatus,
  saveCustomDatabaseConfig,
  resetToFreshLocalDatabase,
} from './databaseConfig';
import {
  createLocalDatabaseClient,
  reseedLocalDatabase,
  cleanAllDatabaseKeepAdminOnly,
} from './localDatabase';

export {
  getDatabaseStatus,
  saveCustomDatabaseConfig,
  resetToFreshLocalDatabase,
  reseedLocalDatabase,
  cleanAllDatabaseKeepAdminOnly,
  isOldDatabase,
  isValidHttpUrl,
};

const activeConfig = getActiveDatabaseConfig();

function isNewSupabaseApiKey(value: string): boolean {
  return value.startsWith('sb_publishable_') || value.startsWith('sb_secret_');
}

function createSupabaseFetch(supabaseKey: string): typeof fetch {
  return (input, init) => {
    const headers = new Headers(
      typeof Request !== 'undefined' && input instanceof Request ? input.headers : undefined,
    );

    if (init?.headers) {
      new Headers(init.headers).forEach((value, key) => headers.set(key, value));
    }

    // New Supabase API keys are opaque strings, not bearer JWTs.
    if (isNewSupabaseApiKey(supabaseKey) && headers.get('Authorization') === `Bearer ${supabaseKey}`) {
      headers.delete('Authorization');
    }

    headers.set('apikey', supabaseKey);
    return fetch(input, { ...init, headers });
  };
}

let clientInstance: any;

if (
  activeConfig.mode === 'cloud' &&
  activeConfig.url &&
  isValidHttpUrl(activeConfig.url) &&
  activeConfig.key &&
  activeConfig.key.length > 5
) {
  try {
    clientInstance = createClient<Database>(activeConfig.url, activeConfig.key, {
      global: {
        fetch: createSupabaseFetch(activeConfig.key),
      },
      auth: {
        storage: brokeredPreviewStorage(),
        persistSession: true,
        autoRefreshToken: true,
      },
    });
  } catch (err) {
    console.warn("Lỗi khởi tạo kết nối Supabase, tự động chuyển về CSDL độc lập:", err);
    clientInstance = createLocalDatabaseClient();
  }
} else {
  // Chế độ Cơ sở dữ liệu Mới Độc Lập
  // Tuyệt đối không kết nối và không ảnh hưởng đến cơ sở dữ liệu cũ
  clientInstance = createLocalDatabaseClient();
}

export const supabase = clientInstance as ReturnType<typeof createClient<Database>>;
