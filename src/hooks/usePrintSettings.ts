import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

export interface FontSizes {
  storeName: number;
  storeAddress: number;
  invoiceTitle: number;
  infoText: number;
  tableHeader: number;
  tableBody: number;
  roomTime: number;
  totalSection: number;
  grandTotal: number;
  footerText: number;
}

export type TextAlign = "left" | "center" | "right";

export type FontWeight = 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900;

export interface TextFormat {
  bold: boolean;
  italic: boolean;
  underline: boolean;
  align: TextAlign;
  fontWeight?: FontWeight;
}

export type TextFormatKey = keyof FontSizes;

export type TextFormats = Record<TextFormatKey, TextFormat>;

export interface SpacingSettings {
  headerBottom: number;
  titleBottom: number;
  infoBottom: number;
  tableBottom: number;
  totalTop: number;
  footerTop: number;
  lineSpacing: number;
}

export type SpacingKey = keyof SpacingSettings;

export interface SectionMargin {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

export interface SectionPadding {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

export interface SectionBorder {
  top: boolean;
  bottom: boolean;
  left: boolean;
  right: boolean;
  style: 'solid' | 'dashed' | 'dotted';
  width: number;
}

export type SectionType = 'header' | 'title' | 'info' | 'items' | 'totals' | 'footer' | 'separator' | 'custom-text' | 'qr-code' | 'logo';

export interface QrCodeSettings {
  content: string;
  size: number;
  align: TextAlign;
  label?: string;
  mode?: 'custom' | 'vietqr';
  amountMode?: 'auto' | 'manual';
  addInfo?: string;
}

export interface BankSettings {
  bankId: string;
  accountNo: string;
  accountName: string;
  template?: string;
}

export type InfoRowId = 'date' | 'room' | 'staff';

export interface InfoRow {
  id: InfoRowId;
  visible: boolean;
  bold: boolean;
}

export interface TemplateSection {
  id: string;
  type: SectionType;
  label: string;
  visible: boolean;
  content?: string;
  showBorder?: boolean;
  borderStyle?: 'solid' | 'dashed' | 'dotted';
  margin?: SectionMargin;
  padding?: SectionPadding;
  border?: SectionBorder;
  qrSettings?: QrCodeSettings;
  textLabel?: string;
  labelBold?: boolean;
  contentBold?: boolean;
  textAlign?: TextAlign;
}

export type DividerId = 'tableHeader' | 'tableRow' | 'grandTotal' | 'separator';

export interface DividerLine {
  enabled: boolean;
  style: 'solid' | 'dashed' | 'dotted';
  width: number;
  color: 'foreground' | 'muted';
}

export type DividerSettings = Record<DividerId, DividerLine>;

export interface CustomLabels {
  invoiceTitle: string;
  dateLabel: string;
  roomLabel: string;
  staffLabel: string;
  colItemName: string;
  colQuantity: string;
  colUnitPrice: string;
  colTotal: string;
  roomTimeLabel: string;
  roomTimeMergedLabel?: string;
  subtotalLabel: string;
  discountLabel: string;
  taxLabel: string;
  grandTotalLabel: string;
}

export type FontFamily = 'monospace' | 'sans-serif' | 'serif' | 'Arial' | 'Verdana' | 'Tahoma' | 'Trebuchet MS' | 'Georgia' | 'Times New Roman' | 'Courier New' | 'Consolas' | 'Roboto' | 'Open Sans' | 'Lato';
export type PrintWeight = 'light' | 'normal' | 'bold';
export type RoomTimeDisplayMode = 'detailed' | 'merged';

export interface LogoSettings {
  enabled: boolean;
  url: string;
  width: number;
  align: TextAlign;
  margin?: SectionMargin;
  padding?: SectionPadding;
  border?: SectionBorder;
  showBorder?: boolean;
  borderStyle?: 'solid' | 'dashed' | 'dotted';
  borderRadius?: number;
}

export interface PrintSettings {
  storeName: string;
  storeAddress: string;
  storePhone: string;
  footerText: string;
  columnWidths: {
    itemName: number;
    quantity: number;
    unitPrice: number;
    total: number;
  };
  fontSizes: FontSizes;
  textFormats: TextFormats;
  spacing: SpacingSettings;
  sections: TemplateSection[];
  customLabels: CustomLabels;
  infoRows: InfoRow[];
  fontFamily: FontFamily;
  printWeight: PrintWeight;
  roomTimeDisplayMode: RoomTimeDisplayMode;
  showRoomTime?: boolean;
  roomTimeBold?: boolean;
  logo: LogoSettings;
  bankSettings: BankSettings;
  dividers: DividerSettings;
}

const DEFAULT_FORMAT: TextFormat = {
  bold: false,
  italic: false,
  underline: false,
  align: "left",
};

export const DEFAULT_FONT_SIZES: FontSizes = {
  storeName: 18,
  storeAddress: 12,
  invoiceTitle: 16,
  infoText: 12,
  tableHeader: 12,
  tableBody: 12,
  roomTime: 12,
  totalSection: 12,
  grandTotal: 14,
  footerText: 12,
};

export const DEFAULT_TEXT_FORMATS: TextFormats = {
  storeName: { ...DEFAULT_FORMAT, align: "center" },
  storeAddress: { ...DEFAULT_FORMAT, align: "center" },
  invoiceTitle: { ...DEFAULT_FORMAT, bold: true, align: "center" },
  infoText: { ...DEFAULT_FORMAT },
  tableHeader: { ...DEFAULT_FORMAT },
  tableBody: { ...DEFAULT_FORMAT },
  roomTime: { ...DEFAULT_FORMAT, bold: true },
  totalSection: { ...DEFAULT_FORMAT },
  grandTotal: { ...DEFAULT_FORMAT, bold: true },
  footerText: { ...DEFAULT_FORMAT, bold: true, align: "center" },
};

export const DEFAULT_SPACING: SpacingSettings = {
  headerBottom: 8,
  titleBottom: 8,
  infoBottom: 8,
  tableBottom: 8,
  totalTop: 4,
  footerTop: 8,
  lineSpacing: 2,
};

export const DEFAULT_MARGIN: SectionMargin = { top: 0, bottom: 0, left: 0, right: 0 };
export const DEFAULT_PADDING: SectionPadding = { top: 0, bottom: 0, left: 0, right: 0 };
export const DEFAULT_BORDER: SectionBorder = { top: false, bottom: false, left: false, right: false, style: 'solid', width: 1 };

export const DEFAULT_CUSTOM_LABELS: CustomLabels = {
  invoiceTitle: "PHIẾU THANH TOÁN",
  dateLabel: "Ngày in:",
  roomLabel: "Số bàn:",
  staffLabel: "Nhân viên:",
  colItemName: "Tên món",
  colQuantity: "SL",
  colUnitPrice: "Đ.Giá",
  colTotal: "T.Tiền",
  roomTimeLabel: "TIỀN GIỜ",
  roomTimeMergedLabel: "TIỀN GIỜ",
  subtotalLabel: "Tổng tiền món:",
  discountLabel: "Giảm bill:",
  taxLabel: "Thuế/Phí",
  grandTotalLabel: "Tổng cộng:",
};

export const DEFAULT_INFO_ROWS: InfoRow[] = [
  { id: 'date', visible: true, bold: false },
  { id: 'room', visible: true, bold: false },
  { id: 'staff', visible: true, bold: false },
];

export const INFO_ROW_NAMES: Record<InfoRowId, string> = {
  date: 'Ngày in',
  room: 'Số bàn / phòng',
  staff: 'Nhân viên',
};

export const DEFAULT_SECTIONS: TemplateSection[] = [
  { id: 'logo', type: 'logo', label: 'Logo cửa hàng', visible: true, showBorder: false, margin: { top: 0, bottom: 4, left: 0, right: 0 }, padding: DEFAULT_PADDING, border: DEFAULT_BORDER },
  { id: 'header', type: 'header', label: 'Thông tin cửa hàng', visible: true, showBorder: true, borderStyle: 'dashed', margin: DEFAULT_MARGIN, padding: DEFAULT_PADDING, border: DEFAULT_BORDER },
  { id: 'title', type: 'title', label: 'Tiêu đề hóa đơn', visible: true, showBorder: true, borderStyle: 'solid', margin: DEFAULT_MARGIN, padding: DEFAULT_PADDING, border: DEFAULT_BORDER },
  { id: 'info', type: 'info', label: 'Thông tin hóa đơn', visible: true, showBorder: true, borderStyle: 'solid', margin: DEFAULT_MARGIN, padding: DEFAULT_PADDING, border: DEFAULT_BORDER },
  { id: 'items', type: 'items', label: 'Bảng sản phẩm/dịch vụ', visible: true, showBorder: false, margin: DEFAULT_MARGIN, padding: DEFAULT_PADDING, border: DEFAULT_BORDER },
  { id: 'totals', type: 'totals', label: 'Tổng tiền', visible: true, showBorder: true, borderStyle: 'solid', margin: DEFAULT_MARGIN, padding: DEFAULT_PADDING, border: DEFAULT_BORDER },
  { id: 'footer', type: 'footer', label: 'Lời cảm ơn', visible: true, showBorder: true, borderStyle: 'solid', margin: DEFAULT_MARGIN, padding: DEFAULT_PADDING, border: DEFAULT_BORDER },
];

const DEFAULT_LOGO: LogoSettings = {
  enabled: false,
  url: '',
  width: 60,
  align: 'center',
  margin: { top: 0, bottom: 4, left: 0, right: 0 },
  padding: { top: 0, bottom: 0, left: 0, right: 0 },
  border: { top: false, bottom: false, left: false, right: false, style: 'solid', width: 1 },
  showBorder: false,
  borderStyle: 'solid',
  borderRadius: 0,
};

const DEFAULT_BANK_SETTINGS: BankSettings = { bankId: '', accountNo: '', accountName: '', template: 'compact2' };

export const DEFAULT_DIVIDERS: DividerSettings = {
  tableHeader: { enabled: true, style: 'solid', width: 1, color: 'foreground' },
  tableRow: { enabled: true, style: 'solid', width: 1, color: 'muted' },
  grandTotal: { enabled: true, style: 'solid', width: 1, color: 'foreground' },
  separator: { enabled: true, style: 'solid', width: 1, color: 'foreground' },
};

export const DIVIDER_NAMES: Record<DividerId, string> = {
  tableHeader: 'Kẻ dưới tiêu đề bảng',
  tableRow: 'Kẻ giữa các dòng món',
  grandTotal: 'Kẻ trên dòng Tổng cộng',
  separator: 'Đường kẻ phân cách (thêm mới)',
};



const DEFAULT_SETTINGS: PrintSettings = {
  storeName: "Karaoke Luyến 2",
  storeAddress: "1784 Quảng Hòa, Quảng Tiến, Trảng Bom",
  storePhone: "0327 309292",
  footerText: "CẢM ƠN QUÝ KHÁCH VÀ HẸN GẶP LẠI!",
  columnWidths: {
    itemName: 40,
    quantity: 15,
    unitPrice: 20,
    total: 25,
  },
  fontSizes: DEFAULT_FONT_SIZES,
  textFormats: DEFAULT_TEXT_FORMATS,
  spacing: DEFAULT_SPACING,
  sections: DEFAULT_SECTIONS,
  customLabels: DEFAULT_CUSTOM_LABELS,
  infoRows: DEFAULT_INFO_ROWS,
  fontFamily: 'monospace',
  printWeight: 'normal' as PrintWeight,
  roomTimeDisplayMode: 'merged',
  showRoomTime: true,
  roomTimeBold: true,
  logo: DEFAULT_LOGO,
  bankSettings: DEFAULT_BANK_SETTINGS,
  dividers: DEFAULT_DIVIDERS,
};

const STORAGE_KEY = "karaoke_print_settings";

const mergeSettings = (parsed: any): PrintSettings => {
  const mergedFontSizes: FontSizes = {
    ...DEFAULT_FONT_SIZES,
    ...(parsed.fontSizes || {}),
    roomTime: parsed.fontSizes?.roomTime ?? parsed.fontSizes?.tableBody ?? DEFAULT_FONT_SIZES.roomTime,
  };

  const isRoomTimeBold = parsed.roomTimeBold !== undefined
    ? !!parsed.roomTimeBold
    : (parsed.textFormats?.roomTime?.bold !== undefined
      ? !!parsed.textFormats.roomTime.bold
      : true);

  const mergedTextFormats: TextFormats = {
    ...DEFAULT_TEXT_FORMATS,
    ...(parsed.textFormats || {}),
    roomTime: parsed.textFormats?.roomTime
      ? { ...DEFAULT_FORMAT, ...parsed.textFormats.roomTime, bold: parsed.textFormats.roomTime.bold !== undefined ? parsed.textFormats.roomTime.bold : isRoomTimeBold }
      : { ...DEFAULT_FORMAT, bold: isRoomTimeBold },
  };

  return {
    ...DEFAULT_SETTINGS,
    ...parsed,
    columnWidths: { ...DEFAULT_SETTINGS.columnWidths, ...(parsed.columnWidths || {}) },
    fontSizes: mergedFontSizes,
    textFormats: mergedTextFormats,
    spacing: { ...DEFAULT_SPACING, ...(parsed.spacing || {}) },
    customLabels: { ...DEFAULT_CUSTOM_LABELS, ...(parsed.customLabels || {}) },
    infoRows: (() => {
      const stored: any[] = Array.isArray(parsed.infoRows) ? parsed.infoRows : [];
      const merged = stored
        .filter((r) => r && DEFAULT_INFO_ROWS.some(d => d.id === r.id))
        .map((r) => ({ id: r.id, visible: r.visible !== false, bold: !!r.bold }));
      DEFAULT_INFO_ROWS.forEach(d => { if (!merged.some(m => m.id === d.id)) merged.push({ ...d }); });
      return merged as InfoRow[];
    })(),
    fontFamily: parsed.fontFamily || DEFAULT_SETTINGS.fontFamily,
    printWeight: parsed.printWeight || DEFAULT_SETTINGS.printWeight,
    roomTimeDisplayMode: (parsed.roomTimeDisplayMode === 'merged' ? 'merged' : 'detailed') as RoomTimeDisplayMode,
    showRoomTime: parsed.showRoomTime !== false,
    roomTimeBold: isRoomTimeBold,
    logo: {
      ...DEFAULT_LOGO,
      ...(parsed.logo || {}),
      margin: { ...DEFAULT_LOGO.margin, ...(parsed.logo?.margin || {}) },
      padding: { ...DEFAULT_LOGO.padding, ...(parsed.logo?.padding || {}) },
      border: { ...DEFAULT_LOGO.border, ...(parsed.logo?.border || {}) },
    },
    dividers: (() => {
      const stored = (parsed.dividers || {}) as Partial<DividerSettings>;
      const out = {} as DividerSettings;
      (Object.keys(DEFAULT_DIVIDERS) as DividerId[]).forEach((k) => {
        out[k] = { ...DEFAULT_DIVIDERS[k], ...(stored[k] || {}) };
      });
      return out;
    })(),
    bankSettings: { ...DEFAULT_BANK_SETTINGS, ...(parsed.bankSettings || {}) },
    sections: (() => {
      let secs: TemplateSection[] = parsed.sections && Array.isArray(parsed.sections) && parsed.sections.length > 0
        ? parsed.sections.map((s: any) => ({
            ...s,
            showBorder: s.showBorder ?? DEFAULT_SECTIONS.find(d => d.id === s.id)?.showBorder ?? false,
            borderStyle: s.borderStyle ?? DEFAULT_SECTIONS.find(d => d.id === s.id)?.borderStyle ?? 'solid',
            margin: { ...DEFAULT_MARGIN, ...(s.margin || {}) },
            padding: { ...DEFAULT_PADDING, ...(s.padding || {}) },
            border: { ...DEFAULT_BORDER, ...(s.border || {}) },
          }))
        : DEFAULT_SECTIONS;

      if (!secs.some((s: TemplateSection) => s.type === 'logo' || s.id === 'logo')) {
        const logoSec: TemplateSection = {
          id: 'logo',
          type: 'logo',
          label: 'Logo cửa hàng',
          visible: parsed.logo?.enabled ?? true,
          showBorder: parsed.logo?.showBorder ?? false,
          borderStyle: parsed.logo?.borderStyle ?? 'solid',
          margin: parsed.logo?.margin ?? { top: 0, bottom: 4, left: 0, right: 0 },
          padding: parsed.logo?.padding ?? DEFAULT_PADDING,
          border: parsed.logo?.border ?? DEFAULT_BORDER,
        };
        secs = [logoSec, ...secs];
      }
      return secs;
    })(),
  };
};

// Shared store so every component (editor + invoice) sees the same settings live
const readInitialSettings = (): PrintSettings => {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) {
    try {
      return mergeSettings(JSON.parse(stored));
    } catch {
      return DEFAULT_SETTINGS;
    }
  }
  return DEFAULT_SETTINGS;
};

let globalSettings: PrintSettings = readInitialSettings();
const listeners = new Set<(s: PrintSettings) => void>();
let dbLoaded = false;

const publishSettings = (next: PrintSettings) => {
  globalSettings = next;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  listeners.forEach(l => l(next));
};

export const usePrintSettings = () => {
  const [settings, setLocalSettings] = useState<PrintSettings>(globalSettings);

  useEffect(() => {
    const listener = (s: PrintSettings) => setLocalSettings(s);
    listeners.add(listener);
    setLocalSettings(globalSettings);

    // Load user-specific bank settings if logged in
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        const userBankKey = `karaoke_bank_settings_${user.id}`;
        const storedBank = localStorage.getItem(userBankKey);
        if (storedBank) {
          try {
            const parsedBank = JSON.parse(storedBank);
            setSettings(prev => ({
              ...prev,
              bankSettings: { ...prev.bankSettings, ...parsedBank }
            }));
          } catch (e) {
            // ignore
          }
        }
      }
    });

    return () => { listeners.delete(listener); };
  }, []);

  const setSettings = useCallback((updater: PrintSettings | ((prev: PrintSettings) => PrintSettings)) => {
    const next = typeof updater === "function" ? (updater as (p: PrintSettings) => PrintSettings)(globalSettings) : updater;
    publishSettings(next);
  }, []);

  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [templateName, setTemplateName] = useState("Mẫu mặc định");
  const [templates, setTemplates] = useState<{ template_name: string; is_default: boolean }[]>([]);


  const loadTemplates = useCallback(async () => {
    const { data } = await supabase.from("print_settings").select("template_name, is_default");
    if (data) setTemplates(data as any[]);
  }, []);

  useEffect(() => {
    const loadFromDb = async () => {
      // Only load from DB once per page session, so in-progress edits are never overwritten
      if (dbLoaded) {
        await loadTemplates();
        setIsLoading(false);
        return;
      }
      dbLoaded = true;
      // Load default template (shared across all users, created by admin)
      const { data } = await supabase.from("print_settings")
        .select("settings, template_name")
        .eq("is_default", true)
        .maybeSingle();
      if (data?.settings) {
        const merged = mergeSettings(data.settings as any);
        publishSettings(merged);
        setTemplateName(data.template_name || "Mẫu mặc định");
      } else {
        // Fallback: load any template
        const { data: fallback } = await supabase.from("print_settings")
          .select("settings, template_name")
          .limit(1)
          .maybeSingle();
        if (fallback?.settings) {
          const merged = mergeSettings(fallback.settings as any);
          publishSettings(merged);
          setTemplateName(fallback.template_name || "Mẫu mặc định");
        }
      }
      await loadTemplates();
      setIsLoading(false);
    };
    loadFromDb();
  }, [loadTemplates]);

  const saveToDatabase = useCallback(async (name?: string) => {
    setIsSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast({ title: "Lỗi", description: "Bạn cần đăng nhập để lưu cấu hình", variant: "destructive" });
        return;
      }
      const saveName = name || templateName;
      const hasDefault = templates.some(t => t.is_default && t.template_name !== saveName);
      const { error } = await supabase.from("print_settings").upsert(
        { user_id: user.id, template_name: saveName, settings: settings as any, is_default: !hasDefault },

        { onConflict: "user_id,template_name" }
      );
      if (error) throw error;
      setTemplateName(saveName);
      await loadTemplates();
      toast({ title: "Đã lưu", description: `Mẫu "${saveName}" đã được lưu` });
    } catch (err) {
      console.error("Save print settings error:", err);
      toast({ title: "Lỗi", description: "Không thể lưu cấu hình. Vui lòng thử lại.", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  }, [settings, templateName, templates.length, loadTemplates]);

  const loadTemplate = useCallback(async (name: string) => {
    const { data } = await supabase.from("print_settings")
      .select("settings, template_name")
      .eq("template_name", name)
      .maybeSingle();
    if (data?.settings) {
      const merged = mergeSettings(data.settings as any);
      setSettings(merged);
      setTemplateName(data.template_name);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
    }
  }, []);

  const deleteTemplate = useCallback(async (name: string) => {
    await supabase.from("print_settings").delete().eq("template_name", name);
    await loadTemplates();
    if (name === templateName) {
      setSettings(DEFAULT_SETTINGS);
      setTemplateName("Mẫu mặc định");
    }
    toast({ title: "Đã xóa", description: `Mẫu "${name}" đã được xóa` });
  }, [templateName, loadTemplates]);

  const setDefaultTemplate = useCallback(async (name: string) => {
    // Clear all defaults first
    await supabase.from("print_settings").update({ is_default: false } as any).neq("template_name", name);
    await supabase.from("print_settings").update({ is_default: true } as any).eq("template_name", name);
    await loadTemplates();
    toast({ title: "Đã cập nhật", description: `"${name}" là mẫu mặc định` });
  }, [loadTemplates]);

  const updateSettings = (newSettings: Partial<PrintSettings>) => {
    setSettings(prev => ({ ...prev, ...newSettings }));
  };

  const updateColumnWidths = (widths: Partial<PrintSettings["columnWidths"]>) => {
    setSettings(prev => ({ ...prev, columnWidths: { ...prev.columnWidths, ...widths } }));
  };

  const updateFontSizes = (sizes: Partial<FontSizes>) => {
    setSettings(prev => ({ ...prev, fontSizes: { ...prev.fontSizes, ...sizes } }));
  };

  const updateTextFormat = (key: TextFormatKey, format: Partial<TextFormat>) => {
    setSettings(prev => ({
      ...prev,
      textFormats: { ...prev.textFormats, [key]: { ...prev.textFormats[key], ...format } },
    }));
  };

  const updateSpacing = (spacing: Partial<SpacingSettings>) => {
    setSettings(prev => ({ ...prev, spacing: { ...prev.spacing, ...spacing } }));
  };

  const updateCustomLabels = (labels: Partial<CustomLabels>) => {
    setSettings(prev => ({ ...prev, customLabels: { ...prev.customLabels, ...labels } }));
  };

  const updateInfoRows = (infoRows: InfoRow[]) => {
    setSettings(prev => ({ ...prev, infoRows }));
  };

  const updateSections = (sections: TemplateSection[]) => {
    setSettings(prev => ({ ...prev, sections }));
  };

  const toggleSectionVisibility = (sectionId: string) => {
    setSettings(prev => {
      const target = prev.sections.find(s => s.id === sectionId);
      const isLogo = target?.type === 'logo' || target?.id === 'logo';
      const nextVisible = target ? !target.visible : true;
      return {
        ...prev,
        logo: isLogo ? { ...prev.logo, enabled: nextVisible } : prev.logo,
        sections: prev.sections.map(s => s.id === sectionId ? { ...s, visible: !s.visible } : s),
      };
    });
  };

  const updateSection = (sectionId: string, updates: Partial<TemplateSection>) => {
    setSettings(prev => {
      const target = prev.sections.find(s => s.id === sectionId);
      const isLogo = target?.type === 'logo' || target?.id === 'logo';
      return {
        ...prev,
        logo: isLogo ? {
          ...prev.logo,
          ...(updates.visible !== undefined ? { enabled: updates.visible } : {}),
          ...(updates.margin !== undefined ? { margin: updates.margin } : {}),
          ...(updates.padding !== undefined ? { padding: updates.padding } : {}),
          ...(updates.border !== undefined ? { border: updates.border } : {}),
          ...(updates.showBorder !== undefined ? { showBorder: updates.showBorder } : {}),
          ...(updates.borderStyle !== undefined ? { borderStyle: updates.borderStyle } : {}),
        } : prev.logo,
        sections: prev.sections.map(s => s.id === sectionId ? { ...s, ...updates } : s),
      };
    });
  };

  const addCustomSection = (type: 'separator' | 'custom-text' | 'qr-code' | 'logo', content?: string) => {
    const id = `${type}-${Date.now()}`;
    const label = type === 'separator' ? 'Đường kẻ phân cách' : type === 'qr-code' ? 'Mã QR' : type === 'logo' ? 'Logo cửa hàng' : 'Văn bản tùy chỉnh';
    const qrSettings: QrCodeSettings | undefined = type === 'qr-code' ? { content: content || 'https://example.com', size: 80, align: 'center' } : undefined;
    setSettings(prev => ({
      ...prev,
      sections: [...prev.sections, { id, type, label, visible: true, content: content || '', showBorder: false, margin: type === 'logo' ? { top: 0, bottom: 4, left: 0, right: 0 } : DEFAULT_MARGIN, padding: DEFAULT_PADDING, border: DEFAULT_BORDER, qrSettings }],
    }));
  };

  const removeSection = (sectionId: string) => {
    setSettings(prev => ({ ...prev, sections: prev.sections.filter(s => s.id !== sectionId) }));
  };

  const updateLogo = (logo: Partial<LogoSettings>) => {
    setSettings(prev => ({
      ...prev,
      logo: { ...prev.logo, ...logo },
      sections: prev.sections.map(s => {
        if (s.type === 'logo' || s.id === 'logo') {
          return {
            ...s,
            visible: logo.enabled !== undefined ? logo.enabled : s.visible,
            margin: logo.margin !== undefined ? { ...s.margin, ...logo.margin } : s.margin,
            padding: logo.padding !== undefined ? { ...s.padding, ...logo.padding } : s.padding,
            border: logo.border !== undefined ? { ...s.border, ...logo.border } : s.border,
            showBorder: logo.showBorder !== undefined ? logo.showBorder : s.showBorder,
            borderStyle: logo.borderStyle !== undefined ? logo.borderStyle : s.borderStyle,
          };
        }
        return s;
      }),
    }));
  };

  const updateDivider = (id: DividerId, updates: Partial<DividerLine>) => {
    setSettings(prev => ({
      ...prev,
      dividers: { ...(prev.dividers || DEFAULT_DIVIDERS), [id]: { ...(prev.dividers || DEFAULT_DIVIDERS)[id], ...updates } },
    }));
  };

  const updateBankSettings = (bank: Partial<BankSettings>) => {
    setSettings(prev => {
      const nextBank = { ...prev.bankSettings, ...bank };
      const next = { ...prev, bankSettings: nextBank };
      supabase.auth.getUser().then(({ data: { user } }) => {
        if (user) {
          localStorage.setItem(`karaoke_bank_settings_${user.id}`, JSON.stringify(nextBank));
        }
      });
      return next;
    });
  };

  const updateFontFamily = (fontFamily: FontFamily) => {
    setSettings(prev => ({ ...prev, fontFamily }));
  };

  const updatePrintWeight = (printWeight: PrintWeight) => {
    setSettings(prev => ({ ...prev, printWeight }));
  };

  const exportSettings = () => {
    const json = JSON.stringify(settings, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `print-template-${templateName}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: "Đã xuất", description: "File cấu hình đã được tải xuống" });
  };

  const importSettings = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const parsed = JSON.parse(e.target?.result as string);
        const merged = mergeSettings(parsed);
        setSettings(merged);
        toast({ title: "Đã nhập", description: "Cấu hình mẫu in đã được áp dụng" });
      } catch {
        toast({ title: "Lỗi", description: "File không hợp lệ", variant: "destructive" });
      }
    };
    reader.readAsText(file);
  };

  const resetToDefaults = () => { setSettings(DEFAULT_SETTINGS); };

  return {
    settings, updateSettings, updateColumnWidths, updateFontSizes,
    updateTextFormat, updateSpacing, updateCustomLabels, updateInfoRows, updateSections,
    toggleSectionVisibility, updateSection, addCustomSection, removeSection,
    resetToDefaults, saveToDatabase, isSaving, isLoading,
    updateLogo, updateBankSettings, updateDivider, updateFontFamily, updatePrintWeight, exportSettings, importSettings,
    templateName, setTemplateName, templates, loadTemplate, deleteTemplate, setDefaultTemplate,
    DEFAULT_SETTINGS, DEFAULT_FONT_SIZES, DEFAULT_TEXT_FORMATS, DEFAULT_SPACING,
  };
};
