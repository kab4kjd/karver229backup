import type { PrintSettings, FontSizes, TextFormats, SpacingSettings, TemplateSection } from "./usePrintSettings";
import {
  DEFAULT_FONT_SIZES,
  DEFAULT_TEXT_FORMATS,
  DEFAULT_SPACING,
  DEFAULT_SECTIONS,
} from "./usePrintSettings";

export interface PrintPreset {
  id: string;
  name: string;
  description: string;
  settings: Partial<PrintSettings>;
}

const minimalFontSizes: FontSizes = {
  ...DEFAULT_FONT_SIZES,
  storeName: 14,
  storeAddress: 10,
  invoiceTitle: 13,
  infoText: 10,
  tableHeader: 10,
  tableBody: 10,
  totalSection: 10,
  grandTotal: 12,
  footerText: 10,
};

const detailedFontSizes: FontSizes = {
  ...DEFAULT_FONT_SIZES,
  storeName: 20,
  storeAddress: 13,
  invoiceTitle: 18,
  infoText: 13,
  tableHeader: 13,
  tableBody: 13,
  totalSection: 13,
  grandTotal: 16,
  footerText: 13,
};

const luxuryFontSizes: FontSizes = {
  ...DEFAULT_FONT_SIZES,
  storeName: 22,
  storeAddress: 12,
  invoiceTitle: 18,
  infoText: 12,
  tableHeader: 12,
  tableBody: 12,
  totalSection: 12,
  grandTotal: 16,
  footerText: 14,
};

const luxuryTextFormats: TextFormats = {
  ...DEFAULT_TEXT_FORMATS,
  storeName: { bold: true, italic: false, underline: false, align: "center", fontWeight: 800 },
  invoiceTitle: { bold: true, italic: false, underline: true, align: "center", fontWeight: 700 },
  grandTotal: { bold: true, italic: false, underline: false, align: "left", fontWeight: 900 },
  footerText: { bold: false, italic: true, underline: false, align: "center", fontWeight: 500 },
};

const minimalSpacing: SpacingSettings = {
  headerBottom: 4,
  titleBottom: 4,
  infoBottom: 4,
  tableBottom: 4,
  totalTop: 2,
  footerTop: 4,
  lineSpacing: 1,
};

const detailedSpacing: SpacingSettings = {
  headerBottom: 10,
  titleBottom: 10,
  infoBottom: 10,
  tableBottom: 10,
  totalTop: 6,
  footerTop: 10,
  lineSpacing: 3,
};

const minimalSections: TemplateSection[] = [
  { id: 'logo', type: 'logo', label: 'Logo cửa hàng', visible: false, showBorder: false },
  { id: 'header', type: 'header', label: 'Thông tin cửa hàng', visible: true, showBorder: false },
  { id: 'title', type: 'title', label: 'Tiêu đề hóa đơn', visible: false, showBorder: false },
  { id: 'info', type: 'info', label: 'Thông tin hóa đơn', visible: true, showBorder: false },
  { id: 'items', type: 'items', label: 'Bảng sản phẩm/dịch vụ', visible: true, showBorder: false },
  { id: 'totals', type: 'totals', label: 'Tổng tiền', visible: true, showBorder: false },
  { id: 'footer', type: 'footer', label: 'Lời cảm ơn', visible: true, showBorder: false },
];

export const PRINT_PRESETS: PrintPreset[] = [
  {
    id: "minimal",
    name: "Tối giản",
    description: "Gọn nhẹ, chỉ thông tin cần thiết, không đường viền",
    settings: {
      fontSizes: minimalFontSizes,
      textFormats: DEFAULT_TEXT_FORMATS,
      spacing: minimalSpacing,
      sections: minimalSections,
    },
  },
  {
    id: "standard",
    name: "Tiêu chuẩn",
    description: "Bố cục cân đối, đường viền rõ ràng",
    settings: {
      fontSizes: DEFAULT_FONT_SIZES,
      textFormats: DEFAULT_TEXT_FORMATS,
      spacing: DEFAULT_SPACING,
      sections: DEFAULT_SECTIONS,
    },
  },
  {
    id: "detailed",
    name: "Chi tiết",
    description: "Font lớn hơn, khoảng cách rộng, dễ đọc",
    settings: {
      fontSizes: detailedFontSizes,
      textFormats: DEFAULT_TEXT_FORMATS,
      spacing: detailedSpacing,
      sections: DEFAULT_SECTIONS,
    },
  },
  {
    id: "luxury",
    name: "Sang trọng",
    description: "Font nổi bật, tiêu đề gạch chân, footer in nghiêng",
    settings: {
      fontSizes: luxuryFontSizes,
      textFormats: luxuryTextFormats,
      spacing: DEFAULT_SPACING,
      sections: DEFAULT_SECTIONS,
    },
  },
];
