import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Printer, RefreshCw, X, Loader2, Clock } from "lucide-react";
import { usePrintSettings, type TextFormat, type TemplateSection, type PrintSettings, type RoomTimeDisplayMode, DEFAULT_MARGIN, DEFAULT_PADDING, DEFAULT_BORDER, DEFAULT_INFO_ROWS, DEFAULT_DIVIDERS } from "@/hooks/usePrintSettings";
import { QRCodeSVG } from "qrcode.react";
import type { InvoiceItem } from "@/pages/Index";
import { normalizeVi } from "@/lib/normalize";
import { calculateRoomTimeCharges, type RoomTimeCalculationResult } from "@/lib/roomTimePricing";

interface InvoiceDisplayProps {
  roomName: string;
  roomPrice: number;
  checkIn: string;
  checkOut: string;
  checkInDate: string;
  checkOutDate: string;
  duration: number;
  actualDuration?: number;
  roomTimeCalculation?: RoomTimeCalculationResult;
  items: InvoiceItem[];
  subtotal: number;
  discount: number;
  tax: number;
  taxRate: number;
  total: number;
  staffName?: string;
  isEditing?: boolean;
  isReadOnly?: boolean;
  isPrinting?: boolean;
  printedAt?: string;
  paymentStatus?: "paid" | "partial" | "debt";
  paidAmount?: number;
  customerName?: string;
  customerSuggestions?: string[];
  minPrintMinutes?: number;
  onPaymentStatusChange?: (status: "paid" | "partial" | "debt") => void;
  onPartialAmountChange?: (amount: number) => void;
  onCustomerNameChange?: (name: string) => void;
  onPrint?: () => void;
  onCancelEdit?: () => void;
  cardId?: string;
}

const getFormatStyle = (fmt: TextFormat): React.CSSProperties => ({
  // Only set fontWeight when explicitly customized (bold or custom weight)
  // Otherwise omit so the element inherits the base print weight from container
  ...(fmt.fontWeight ? { fontWeight: fmt.fontWeight } : fmt.bold ? { fontWeight: 700 } : {}),
  fontStyle: fmt.italic ? "italic" : "normal",
  textDecoration: fmt.underline ? "underline" : "none",
  textAlign: fmt.align
});

const getSectionBoxStyle = (section: {
  margin?: SectionMargin;
  padding?: SectionPadding;
  border?: SectionBorder;
  showBorder?: boolean;
  borderStyle?: 'solid' | 'dashed' | 'dotted';
}): React.CSSProperties => {
  const m = section.margin || DEFAULT_MARGIN;
  const p = section.padding || DEFAULT_PADDING;
  const b = section.border || DEFAULT_BORDER;
  const showBorder = section.showBorder;
  const borderStyle = section.borderStyle || 'solid';

  return {
    marginTop: `${m.top}px`, marginBottom: `${m.bottom}px`,
    marginLeft: `${m.left}px`, marginRight: `${m.right}px`,
    paddingTop: `${p.top}px`, paddingBottom: `${p.bottom}px`,
    paddingLeft: `${p.left}px`, paddingRight: `${p.right}px`,
    borderTopWidth: b.top ? `${b.width}px` : (showBorder ? '1px' : '0'),
    borderBottomWidth: b.bottom ? `${b.width}px` : (showBorder ? '1px' : '0'),
    borderLeftWidth: b.left ? `${b.width}px` : '0',
    borderRightWidth: b.right ? `${b.width}px` : '0',
    borderStyle: showBorder ? borderStyle : b.style,
    borderColor: (b.top || b.bottom || b.left || b.right || showBorder) ? 'currentColor' : 'transparent',
  };
};

const InvoiceDisplay = ({
  roomName, roomPrice, checkIn, checkOut, checkInDate, checkOutDate,
  duration, actualDuration, roomTimeCalculation, items, subtotal, discount, tax, taxRate, total,
  staffName, isEditing, isReadOnly, isPrinting, printedAt, paymentStatus, paidAmount,
  customerName, customerSuggestions, minPrintMinutes,
  onPaymentStatusChange, onPartialAmountChange, onCustomerNameChange, onPrint, onCancelEdit,
  cardId = "invoice-area"
}: InvoiceDisplayProps) => {
  const [customerFocused, setCustomerFocused] = useState(false);
  const [overrideDisplayMode, setOverrideDisplayMode] = useState<RoomTimeDisplayMode | null>(null);

  const filteredSuggestions = useMemo(() => {
    const q = normalizeVi(customerName || "").trim();
    const list = (customerSuggestions ?? []).filter(Boolean);
    const uniq = Array.from(new Set(list));
    if (!q) return uniq.slice(0, 8);
    return uniq.filter(n => normalizeVi(n).includes(q)).slice(0, 8);
  }, [customerName, customerSuggestions]);

  const { settings } = usePrintSettings();
  const fs = settings.fontSizes;
  const tf = settings.textFormats;
  const sp = settings.spacing;
  const cl = settings.customLabels;

  const currentDisplayMode = overrideDisplayMode || settings.roomTimeDisplayMode || 'detailed';

  // Compute room calculation if not provided
  const effectiveRoomCalc: RoomTimeCalculationResult = useMemo(() => {
    if (roomTimeCalculation) return roomTimeCalculation;
    return calculateRoomTimeCharges({
      checkInDate,
      checkIn,
      checkOutDate,
      checkOut,
      defaultPrice: roomPrice,
      useTimeSlots: false,
    });
  }, [roomTimeCalculation, checkInDate, checkIn, checkOutDate, checkOut, roomPrice]);

  const effectiveMinPrintMinutes = minPrintMinutes !== undefined ? minPrintMinutes : 15;
  const actualMinutes = Math.max(0, Math.round((effectiveRoomCalc.actualDuration ?? actualDuration ?? (duration || 0)) * 60));

  const formatDuration = (hours: number) => {
    const h = Math.floor(hours);
    const m = Math.round((hours - h) * 60);
    return `${h}h ${m}m`;
  };

  const formatDateTime = (dateStr: string, timeStr: string) => {
    if (!dateStr || !timeStr) return timeStr;
    const [year, month, day] = dateStr.split("-");
    return `${day}/${month} ${timeStr}`;
  };

  const dividers = settings.dividers || DEFAULT_DIVIDERS;
  const dividerStyle = (id: keyof typeof dividers, side: 'top' | 'bottom' = 'bottom'): React.CSSProperties => {
    const d = dividers[id] || DEFAULT_DIVIDERS[id];
    if (!d?.enabled) return {};
    const color = d.color === 'muted' ? 'hsl(var(--muted))' : 'hsl(var(--foreground))';
    const value = `${d.width}px ${d.style} ${color}`;
    return side === 'top' ? { borderTop: value } : { borderBottom: value };
  };

  const getBorderClass = (section: TemplateSection, position: 'bottom' | 'top' = 'bottom') => {
    if (!section.showBorder) return '';
    const side = position === 'bottom' ? 'border-b' : 'border-t';
    const style = section.borderStyle === 'dashed' ? 'border-dashed' : section.borderStyle === 'dotted' ? 'border-dotted' : 'border-solid';
    return `${side} ${style} border-foreground`;
  };

  const renderSectionInner = (section: TemplateSection) => {
    switch (section.type) {
      case 'logo': {
        if (!settings.logo?.enabled || !settings.logo?.url) return null;
        return (
          <div key={section.id} className={getBorderClass(section)} style={{ textAlign: settings.logo.align || 'center' }}>
            <img
              src={settings.logo.url}
              alt="Logo"
              style={{
                width: `${settings.logo.width || 60}px`,
                display: 'inline-block',
                borderRadius: settings.logo.borderRadius ? `${settings.logo.borderRadius}px` : undefined,
              }}
            />
          </div>
        );
      }

      case 'header':
        return (
          <div key={section.id} className={`text-center ${getBorderClass(section)}`} style={{
            paddingBottom: `${sp.headerBottom}px`, marginBottom: `${sp.lineSpacing}px`
          }}>
            <h2 style={{ fontSize: `${fs.storeName}px`, ...getFormatStyle(tf.storeName) }} className="text-foreground">{settings.storeName}</h2>
            <p style={{ fontSize: `${fs.storeAddress}px`, ...getFormatStyle(tf.storeAddress) }}>{settings.storeAddress}</p>
            <p style={{ fontSize: `${fs.storeAddress}px`, ...getFormatStyle(tf.storeAddress) }}>ĐT: {settings.storePhone}</p>
          </div>
        );

      case 'title':
        return (
          <div key={section.id} className={`text-center ${getBorderClass(section)}`} style={{
            paddingBottom: `${sp.titleBottom}px`, marginBottom: `${sp.lineSpacing}px`
          }}>
            <h3 style={{ fontSize: `${fs.invoiceTitle}px`, ...getFormatStyle(tf.invoiceTitle) }} className="text-foreground my-[18px] font-bold">{cl.invoiceTitle}</h3>
          </div>
        );

      case 'info': {
        const rows = settings.infoRows?.length ? settings.infoRows : DEFAULT_INFO_ROWS;
        const rowContent: Record<string, { label: string; value: React.ReactNode } | null> = {
          date: { label: cl.dateLabel, value: new Date(printedAt ?? Date.now()).toLocaleString("vi-VN") },
          room: roomName ? { label: cl.roomLabel, value: <span style={{ fontSize: '14px' }}>{roomName}</span> } : null,
          staff: { label: cl.staffLabel, value: staffName || 'Nhân viên' },
        };
        return (
          <div key={section.id} className={getBorderClass(section)} style={{
            marginBottom: `${sp.infoBottom}px`, paddingBottom: `${sp.lineSpacing}px`
          }}>
            {rows.filter(r => r.visible).map(r => {
              const c = rowContent[r.id];
              if (!c) return null;
              return (
                <div key={r.id} className="flex gap-2" style={{
                  fontSize: `${fs.infoText}px`,
                  ...getFormatStyle(tf.infoText),
                  ...(r.bold ? { fontWeight: 700 } : {}),
                }}>
                  <span>{c.label}</span>
                  <span>{c.value}</span>
                </div>
              );
            })}
          </div>
        );
      }

      case 'items':
        return (
          <div key={section.id} style={{ marginBottom: `${sp.tableBottom}px` }}>
            <table className="w-full">
              <thead style={dividerStyle('tableHeader')}>
                <tr>
                  <th style={{ width: `${settings.columnWidths.itemName}%`, fontSize: `${fs.tableHeader}px`, ...getFormatStyle(tf.tableHeader) }} className="text-left py-0.5">{cl.colItemName}</th>
                  <th style={{ width: `${settings.columnWidths.quantity}%`, fontSize: `${fs.tableHeader}px`, ...getFormatStyle(tf.tableHeader) }} className="text-center py-1">{cl.colQuantity}</th>
                  <th style={{ width: `${settings.columnWidths.unitPrice}%`, fontSize: `${fs.tableHeader}px`, ...getFormatStyle(tf.tableHeader) }} className="text-right py-1">{cl.colUnitPrice}</th>
                  <th style={{ width: `${settings.columnWidths.total}%`, fontSize: `${fs.tableHeader}px`, ...getFormatStyle(tf.tableHeader) }} className="text-right py-1">{cl.colTotal}</th>
                </tr>
              </thead>
              <tbody>
                {items.map(item => (
                  <tr key={item.id} style={dividerStyle('tableRow')}>
                    <td className="py-1 uppercase" style={{ fontSize: `${fs.tableBody}px`, ...getFormatStyle(tf.tableBody) }}>{item.name}</td>
                    <td className="text-center py-1" style={{ fontSize: `${fs.tableBody}px` }}>{item.quantity}</td>
                    <td className="text-right py-1" style={{ fontSize: `${fs.tableBody}px` }}>{item.price.toLocaleString("vi-VN")}</td>
                    <td className="text-right py-1" style={{ fontSize: `${fs.tableBody}px` }}>{(item.price * item.quantity).toLocaleString("vi-VN")}</td>
                  </tr>
                ))}

                {/* ROOM TIME CHARGE ROWS */}
                {settings.showRoomTime !== false && (duration > 0 || (actualDuration ?? 0) > 0 || (effectiveRoomCalc?.totalDuration ?? 0) > 0 || (effectiveRoomCalc?.totalAmount ?? 0) > 0) && (roomPrice > 0 || (effectiveRoomCalc?.totalAmount ?? 0) > 0 || (effectiveRoomCalc?.segments && effectiveRoomCalc.segments.length > 0)) && (() => {
                  const roomTimeFs = fs.roomTime ?? fs.tableBody;
                  const roomTimeTf = tf.roomTime ?? tf.tableBody;
                  const isRoomTimeBold = roomTimeTf.bold !== undefined ? roomTimeTf.bold : (settings.roomTimeBold !== undefined ? settings.roomTimeBold : true);
                  const roomTimeWeight = roomTimeTf.fontWeight || (isRoomTimeBold ? 700 : 400);
                  const roomTimeStyle: React.CSSProperties = {
                    fontSize: `${roomTimeFs}px`,
                    ...getFormatStyle(roomTimeTf),
                    fontWeight: roomTimeWeight,
                  };
                  const roomTimeBoldClass = roomTimeWeight >= 700 || isRoomTimeBold ? "font-bold" : roomTimeWeight <= 300 ? "font-light" : "font-normal";
                  const rawCalcDuration = actualDuration ?? (duration > 0 ? duration : (effectiveRoomCalc?.totalDuration ?? effectiveRoomCalc?.totalHours ?? 0));
                  const calcDuration = typeof rawCalcDuration === 'number' && !isNaN(rawCalcDuration) ? rawCalcDuration : 0;

                  const showDetailedSegments = currentDisplayMode === 'detailed' && effectiveRoomCalc?.segments && effectiveRoomCalc.segments.length > 0;
                  const appliesMultipleSlots = Boolean(
                    effectiveRoomCalc?.hasMultipleSlots ??
                    (effectiveRoomCalc?.segments &&
                      effectiveRoomCalc.segments.length > 1 &&
                      new Set(effectiveRoomCalc.segments.map((s) => s.slotName || s.pricePerHour)).size > 1)
                  );

                  return showDetailedSegments ? (
                    // OPTION 1: Detailed breakdown by time slot
                    effectiveRoomCalc.segments.map((segment) => {
                      const segHours = typeof segment?.hours === 'number' && !isNaN(segment.hours) ? segment.hours : 0;
                      const customSlotLabel = appliesMultipleSlots &&
                        segment.slotName &&
                        segment.slotName.trim() !== '' &&
                        segment.slotName !== 'default' &&
                        segment.slotName !== 'Tiêu chuẩn' &&
                        segment.slotName !== '24h'
                        ? ` (${segment.slotName})`
                        : '';
                      return (
                        <tr key={segment.id} style={dividerStyle('tableRow')}>
                          <td className={`py-1 uppercase ${roomTimeBoldClass}`} style={roomTimeStyle}>
                            <div style={{ fontWeight: roomTimeWeight }}>
                              {cl.roomTimeLabel}{customSlotLabel}
                            </div>
                            <div style={{ fontSize: `${Math.max(roomTimeFs - 2, 8)}px`, fontWeight: 400 }} className="text-foreground normal-case font-normal">
                              {segment.startTime} =&gt; {segment.endTime} ({formatDuration(segHours)})
                            </div>
                          </td>
                          <td className={`text-center py-1 ${roomTimeBoldClass}`} style={roomTimeStyle}>{segHours.toFixed(2)}</td>
                          <td className={`text-right py-1 ${roomTimeBoldClass}`} style={roomTimeStyle}>{Math.round(segment?.pricePerHour ?? 0).toLocaleString("vi-VN")}</td>
                          <td className={`text-right py-1 ${roomTimeBoldClass}`} style={roomTimeStyle}>{Math.round(segment?.amount ?? 0).toLocaleString("vi-VN")}</td>
                        </tr>
                      );
                    })
                  ) : (
                    // OPTION 2: Merged / Single line calculation
                    <tr style={dividerStyle('tableRow')}>
                      <td className={`py-1 uppercase ${roomTimeBoldClass}`} style={roomTimeStyle}>
                        <div style={{ fontWeight: roomTimeWeight }}>
                          {cl.roomTimeLabel}
                        </div>
                        <div style={{ fontSize: `${Math.max(roomTimeFs - 2, 8)}px`, fontWeight: 400 }} className="text-foreground normal-case font-normal">
                          {formatDateTime(checkInDate, checkIn)} =&gt; {formatDateTime(checkOutDate, checkOut)} ({formatDuration(calcDuration)})
                        </div>
                      </td>
                      <td className={`text-center py-1 ${roomTimeBoldClass}`} style={roomTimeStyle}>{calcDuration.toFixed(2)}</td>
                      <td className={`text-right py-1 ${roomTimeBoldClass}`} style={roomTimeStyle}>{Math.round(effectiveRoomCalc?.averagePricePerHour || roomPrice || 0).toLocaleString("vi-VN")}</td>
                      <td className={`text-right py-1 ${roomTimeBoldClass}`} style={roomTimeStyle}>{Math.round(effectiveRoomCalc?.totalAmount || 0).toLocaleString("vi-VN")}</td>
                    </tr>
                  );
                })()}
              </tbody>
            </table>
          </div>
        );

      case 'totals':
        return (
          <div key={section.id} className={getBorderClass(section, 'top')} style={{ paddingTop: `${sp.totalTop}px` }}>
            <div className="flex items-start justify-between" style={{ fontSize: `${fs.totalSection}px`, ...getFormatStyle(tf.totalSection) }}>
              <span>{cl.subtotalLabel}</span>
              <span>{subtotal.toLocaleString("vi-VN")}</span>
            </div>
            {discount > 0 && (
              <div className="flex justify-between" style={{ fontSize: `${fs.totalSection}px`, ...getFormatStyle(tf.totalSection) }}>
                <span>{cl.discountLabel}</span>
                <span>{`-${discount.toLocaleString("vi-VN")}`}</span>
              </div>
            )}
            {tax > 0 && (
              <div className="flex justify-between" style={{ fontSize: `${fs.totalSection}px`, ...getFormatStyle(tf.totalSection) }}>
                <span>{cl.taxLabel} ({taxRate}%):</span>
                <span>{tax.toLocaleString("vi-VN")}</span>
              </div>
            )}
            <div className="flex justify-between pt-1 mt-1" style={{ fontSize: `${fs.grandTotal}px`, ...getFormatStyle(tf.grandTotal), ...dividerStyle('grandTotal', 'top') }}>
              <span>{cl.grandTotalLabel}</span>
              <span>{total.toLocaleString("vi-VN")}</span>
            </div>
          </div>
        );

      case 'footer':
        return (
          <div key={section.id} className={`text-center ${getBorderClass(section, 'top')}`} style={{
            marginTop: `${sp.footerTop}px`, paddingTop: `${sp.lineSpacing}px`
          }}>
            <p style={{ fontSize: `${fs.footerText}px`, ...getFormatStyle(tf.footerText) }} className="my-[3px]">{settings.footerText}</p>
          </div>
        );

      case 'separator': {
        const d = dividers.separator || DEFAULT_DIVIDERS.separator;
        if (!d.enabled) return null;
        return (
          <hr
            key={section.id}
            className="my-1"
            style={{
              border: 0,
              borderTop: `${d.width}px ${d.style} ${d.color === 'muted' ? 'hsl(var(--muted))' : 'hsl(var(--foreground))'}`,
            }}
          />
        );
      }

      case 'custom-text':
        return (
          <div key={section.id} className="py-1" style={{ textAlign: section.textAlign || 'center' }}>
            {section.textLabel && (
              <span style={{ fontSize: `${fs.infoText}px`, fontWeight: section.labelBold ? 700 : undefined, marginRight: '4px' }}>
                {section.textLabel}
              </span>
            )}
            <span style={{ fontSize: `${fs.infoText}px`, fontWeight: section.contentBold ? 700 : undefined, whiteSpace: 'pre-wrap' }}>
              {section.content || ''}
            </span>
          </div>
        );

      case 'qr-code': {
        const qr = section.qrSettings || { content: '', size: 80, align: 'center' as const };
        const mode = qr.mode || 'custom';
        const amountMode = qr.amountMode || 'auto';
        const bank = settings.bankSettings;
        let qrValue = qr.content;
        if (mode === 'vietqr' && bank?.bankId && bank?.accountNo) {
          const rawAddInfo = qr.addInfo || "Thanh toan {room}";
          const formattedAddInfo = rawAddInfo.replace("{room}", roomName || "phong");
          const desc = encodeURIComponent(formattedAddInfo);
          const accName = encodeURIComponent(bank.accountName || '');
          const amountParam = amountMode === 'auto' && total > 0 ? `&amount=${Math.round(total)}` : '';
          qrValue = `https://img.vietqr.io/image/${bank.bankId}-${bank.accountNo}-${bank.template || 'compact2'}.png?addInfo=${desc}&accountName=${accName}${amountParam}`;
        }
        return qrValue ? (
          <div key={section.id} style={{ textAlign: qr.align }} className="py-1">
            {mode === 'vietqr' ? (
              <img src={qrValue} alt="VietQR" style={{ width: `${qr.size}px`, display: 'inline-block' }} />
            ) : (
              <QRCodeSVG value={qrValue} size={qr.size} />
            )}
            {qr.label && <p style={{ fontSize: `${fs.infoText}px` }} className="mt-1">{qr.label}</p>}
          </div>
        ) : null;
      }

      default:
        return null;
    }
  };

  const renderSection = (section: TemplateSection) => {
    if (!section.visible) return null;
    const inner = renderSectionInner(section);
    if (!inner) return null;
    return (
      <div key={section.id} style={getSectionBoxStyle(section)}>
        {inner}
      </div>
    );
  };



  return (
    <div id={cardId === "invoice-area" ? "invoice-print-root" : `${cardId}-root`} className="space-y-2">
      <Card id={cardId} className="p-3 print:shadow-none print:border-0 rounded-sm max-w-[80mm] mx-auto print:max-w-none print:rounded-none" style={{ fontFamily: settings.fontFamily || 'monospace', '--print-weight': settings.printWeight || 'normal' } as React.CSSProperties}>
        {!settings.sections.some(s => s.type === 'logo') && settings.logo?.enabled && settings.logo?.url && (
          <div style={{ textAlign: settings.logo.align, ...getSectionBoxStyle(settings.logo) }}>
            <img
              src={settings.logo.url}
              alt="Logo"
              style={{
                width: `${settings.logo.width}px`,
                display: 'inline-block',
                borderRadius: settings.logo.borderRadius ? `${settings.logo.borderRadius}px` : undefined,
              }}
            />
          </div>
        )}
        {settings.sections.map(section => renderSection(section))}

        {onPrint && (
          <div className="mt-4 print:hidden space-y-2">
            {isEditing && (
              <div className={`flex items-center justify-center gap-2 text-sm p-2 rounded-md mb-2 ${isReadOnly ? "text-blue-700 bg-blue-50" : "text-amber-600 bg-amber-50"}`}>
                <RefreshCw className="h-4 w-4" />
                <span>{isReadOnly ? "Chỉ xem — cập nhật thanh toán & in lại" : "Đang chỉnh sửa hóa đơn"}</span>
              </div>
            )}
            <Button onClick={onPrint} className="w-full gap-2" disabled={isPrinting}>
              {isPrinting ? (
                <><Loader2 className="h-4 w-4 animate-spin" />Đang xử lý...</>
              ) : (
                <><Printer className="h-4 w-4" />{isReadOnly ? "Cập nhật thanh toán & In lại" : isEditing ? "Cập nhật & In hóa đơn" : "In hóa đơn"}</>
              )}
            </Button>
            {isEditing && onCancelEdit && (
              <Button onClick={onCancelEdit} variant="outline" className="w-full gap-2">
                <X className="h-4 w-4" />
                {isReadOnly ? "Đóng" : "Hủy chỉnh sửa"}
              </Button>
            )}

            {onPaymentStatusChange && (
              <div className="space-y-2 pt-3 border-t border-border mt-3">
                <Label className="text-sm font-medium">Trạng thái thanh toán</Label>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant={paymentStatus === "paid" ? "default" : "outline"}
                    size="sm"
                    className={paymentStatus === "paid" ? "bg-green-600 hover:bg-green-700" : ""}
                    onClick={() => onPaymentStatusChange("paid")}
                  >
                    Thanh toán đủ
                  </Button>
                  <Button
                    type="button"
                    variant={paymentStatus === "debt" ? "default" : "outline"}
                    size="sm"
                    className={paymentStatus === "debt" ? "bg-red-600 hover:bg-red-700" : ""}
                    onClick={() => onPaymentStatusChange("debt")}
                  >
                    Nợ
                  </Button>
                  <Button
                    type="button"
                    variant={paymentStatus === "partial" ? "default" : "outline"}
                    size="sm"
                    className={paymentStatus === "partial" ? "bg-yellow-600 hover:bg-yellow-700" : ""}
                    onClick={() => onPaymentStatusChange("partial")}
                  >
                    Trả một phần
                  </Button>
                </div>
                {paymentStatus === "partial" && onPartialAmountChange && (
                  <div>
                    <Label className="text-sm">Số tiền đã trả</Label>
                    <Input
                      type="number"
                      value={paidAmount ?? 0}
                      onChange={(e) => onPartialAmountChange(Number(e.target.value))}
                      placeholder="VNĐ"
                      min={0}
                      max={total}
                    />
                  </div>
                )}
                {(paymentStatus === "debt" || paymentStatus === "partial") && onCustomerNameChange && (
                  <div className="relative">
                    <Label className="text-sm">Tên khách hàng</Label>
                    <Input
                      value={customerName ?? ""}
                      onChange={(e) => onCustomerNameChange(e.target.value)}
                      onFocus={() => setCustomerFocused(true)}
                      onBlur={() => setTimeout(() => setCustomerFocused(false), 150)}
                      placeholder="Nhập tên khách hàng nợ"
                      autoComplete="off"
                    />
                    {customerFocused && filteredSuggestions.length > 0 && (
                      <div className="absolute z-50 mt-1 w-full bg-popover border border-border rounded-md shadow-md max-h-48 overflow-auto">
                        {filteredSuggestions.map((name) => (
                          <button
                            key={name}
                            type="button"
                            className="w-full text-left px-3 py-1.5 text-sm hover:bg-accent"
                            onMouseDown={(e) => { e.preventDefault(); onCustomerNameChange(name); setCustomerFocused(false); }}
                          >
                            {name}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </Card>
    </div>
  );
};

export default InvoiceDisplay;
