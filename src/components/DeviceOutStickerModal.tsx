import React, { useState, useEffect, useRef } from 'react';
import {
  Printer,
  X,
  CheckCircle,
  AlertCircle,
  History,
  ShieldCheck,
  Tag,
  Calendar,
  User,
  HardDrive
} from 'lucide-react';
import { DeviceOutRequest, LabelTemplate, LabelPrintHistory } from '../types';
import { api } from '../services/api';

interface DeviceOutStickerModalProps {
  request: DeviceOutRequest;
  currentUser?: { id: string; name: string; role: string };
  onClose: () => void;
  onPrintSuccess?: () => void;
}

export const DeviceOutStickerModal: React.FC<DeviceOutStickerModalProps> = ({
  request,
  currentUser,
  onClose,
  onPrintSuccess,
}) => {
  const [template, setTemplate] = useState<LabelTemplate | null>(null);
  const [availableTemplates, setAvailableTemplates] = useState<LabelTemplate[]>([]);
  const [printerName, setPrinterName] = useState<string>('SATO CL4NX (Windows Thermal)');
  const [isPrinting, setIsPrinting] = useState(false);
  const [printError, setPrintError] = useState<string | null>(null);
  const [printSuccessMsg, setPrintSuccessMsg] = useState<string | null>(null);
  const [printHistory, setPrintHistory] = useState<LabelPrintHistory[]>([]);
  const stickerPrintRef = useRef<HTMLDivElement>(null);

  const isApproved = request.approvalStatus === 'Approved' || request.approvalStatus === 'In Progress';
  const isReturnedOrClosed = request.approvalStatus === 'Returned/Closed' || request.status === 'Closed' || request.status === 'Returned';

  useEffect(() => {
    loadTemplateAndHistory();
  }, [request.id]);

  const loadTemplateAndHistory = async () => {
    try {
      const tRes = await api.getLabelTemplates();
      if (tRes.success && tRes.data && tRes.data.length > 0) {
        setAvailableTemplates(tRes.data);
        const active = tRes.data.find((t) => t.isActive) || tRes.data[0];
        setTemplate(active);
      }

      const reqRes = await api.getDeviceOutRequest(request.id);
      if (reqRes.success && reqRes.data?.printHistory) {
        setPrintHistory(reqRes.data.printHistory);
      }
    } catch (err) {
      console.error('Failed to load template data:', err);
    }
  };

  const escapeHtml = (value: unknown): string =>
    String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');

  const buildSatoPrintHtml = (): string => {
    const printWidthMm = template?.widthMm || 70;
    const printHeightMm = template?.heightMm || 24;

    const clamp = (value: number, min: number, max: number) =>
      Math.max(min, Math.min(value, max));

    const elements = (template?.elements || [])
      .filter((el) => el.visible)
      .map((el) => {
        const safeWidth = clamp(Number(el.widthMm) || 0, 0, printWidthMm);
        const safeHeight = clamp(Number(el.heightMm) || 0, 0, printHeightMm);
        const safeX = clamp(Number(el.xMm) || 0, 0, Math.max(0, printWidthMm - safeWidth));
        const safeY = clamp(Number(el.yMm) || 0, 0, Math.max(0, printHeightMm - safeHeight));
        const rawValue = el.fieldType === 'static' ? (el.staticText || '') : getFieldValue(el.fieldKey);
        const value = escapeHtml(rawValue);

        // The editor fontSize is screen-oriented. Convert it to a practical
        // physical size and also cap it by the element height so a 70 x 24 mm
        // thermal label cannot blow up in Chrome/Windows print preview.
        const requestedFontMm = (Number(el.fontSize) || 10) * 0.18;
        const maxByHeightMm = Math.max(1.4, safeHeight * 0.68);
        const fontMm = clamp(Math.min(requestedFontMm, maxByHeightMm), 1.4, 4.2);

        const weight =
          el.fontWeight === 'bold' ? 700 : el.fontWeight === 'medium' ? 600 : 400;
        const align =
          el.alignment === 'center' ? 'center' : el.alignment === 'right' ? 'right' : 'left';
        const justify =
          el.alignment === 'center'
            ? 'center'
            : el.alignment === 'right'
            ? 'flex-end'
            : 'flex-start';
        const rotation = Number(el.rotation) || 0;

        if (el.elementType === 'badge') {
          return `
            <div class="label-element badge" style="
              left:${safeX}mm;
              top:${safeY}mm;
              width:${safeWidth}mm;
              height:${safeHeight}mm;
              font-size:${fontMm}mm;
              font-weight:${weight};
              text-align:${align};
              justify-content:${justify};
              transform:${rotation ? `rotate(${rotation}deg)` : 'none'};
            ">${value}</div>`;
        }

        return `
          <div class="label-element text" style="
            left:${safeX}mm;
            top:${safeY}mm;
            width:${safeWidth}mm;
            height:${safeHeight}mm;
            font-size:${fontMm}mm;
            font-weight:${weight};
            text-align:${align};
            justify-content:${justify};
            transform:${rotation ? `rotate(${rotation}deg)` : 'none'};
          "><span>${value}</span></div>`;
      })
      .join('');

    const fallback = `
      <div class="fallback">
        <div class="fallback-title">BRING DEVICE OUT PASS</div>
        <div class="fallback-line fallback-req">REQ NO: ${escapeHtml(request.requestId)}</div>
        <div class="fallback-line">Requestor: ${escapeHtml(request.requesterName)} (${escapeHtml(request.departmentName || 'General')})</div>
        <div class="fallback-line">Asset: ${escapeHtml(request.assetName || request.serviceName)}</div>
        <div class="fallback-dates">
          <span>From: ${escapeHtml(request.fromDate ? new Date(request.fromDate).toLocaleDateString('en-GB') : '-')}</span>
          <span>To: ${escapeHtml(request.toDate ? new Date(request.toDate).toLocaleDateString('en-GB') : '-')}</span>
        </div>
        <div class="fallback-line">Approver: ${escapeHtml(request.approvedByName || 'Authorized Approver')}</div>
      </div>`;

    return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>SATO CL4NX Sticker</title>
  <style>
    @page {
      size: ${printWidthMm}mm ${printHeightMm}mm;
      margin: 0;
    }

    html, body {
      width: ${printWidthMm}mm;
      height: ${printHeightMm}mm;
      min-width: ${printWidthMm}mm;
      min-height: ${printHeightMm}mm;
      max-width: ${printWidthMm}mm;
      max-height: ${printHeightMm}mm;
      margin: 0;
      padding: 0;
      overflow: hidden;
      background: #fff;
    }

    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    body {
      font-family: Arial, Helvetica, sans-serif;
    }

    #label {
      position: relative;
      width: ${printWidthMm}mm;
      height: ${printHeightMm}mm;
      margin: 0;
      padding: 0;
      overflow: hidden;
      border: 0.35mm solid #000;
      background: #fff;
      color: #000;
      page-break-before: avoid;
      page-break-after: avoid;
      page-break-inside: avoid;
      break-before: avoid;
      break-after: avoid;
      break-inside: avoid;
    }

    .label-element {
      position: absolute;
      display: flex;
      align-items: center;
      overflow: hidden;
      line-height: 1;
      white-space: nowrap;
      transform-origin: center center;
    }

    .label-element.text span {
      display: block;
      width: 100%;
      overflow: hidden;
      white-space: nowrap;
      text-overflow: clip;
    }

    .badge {
      background: #000;
      color: #fff;
      align-items: center;
      letter-spacing: 0.15mm;
      overflow: hidden;
    }

    .fallback {
      width: 100%;
      height: 100%;
      padding: 1.2mm;
      overflow: hidden;
      font-weight: 700;
    }

    .fallback-title {
      height: 5mm;
      background: #000;
      color: #fff;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 3mm;
      line-height: 1;
      white-space: nowrap;
      overflow: hidden;
    }

    .fallback-line,
    .fallback-dates {
      height: 3.2mm;
      display: flex;
      align-items: center;
      font-size: 2.2mm;
      line-height: 1;
      white-space: nowrap;
      overflow: hidden;
    }

    .fallback-req { justify-content: flex-end; }
    .fallback-dates { justify-content: space-between; }

    @media print {
      html, body, #label {
        margin: 0 !important;
        padding: 0 !important;
      }
    }
  </style>
</head>
<body>
  <div id="label">${elements || fallback}</div>
</body>
</html>`;
  };

  const printSatoLabel = (html: string) => {
    const iframe = document.createElement('iframe');
    iframe.setAttribute('aria-hidden', 'true');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '1px';
    iframe.style.height = '1px';
    iframe.style.border = '0';
    iframe.style.opacity = '0';
    iframe.style.pointerEvents = 'none';
    document.body.appendChild(iframe);

    const frameWindow = iframe.contentWindow;
    const frameDocument = iframe.contentDocument;

    if (!frameWindow || !frameDocument) {
      iframe.remove();
      throw new Error('Unable to create the SATO print frame.');
    }

    frameDocument.open();
    frameDocument.write(html);
    frameDocument.close();

    const cleanup = () => {
      window.setTimeout(() => iframe.remove(), 500);
    };

    frameWindow.addEventListener('afterprint', cleanup, { once: true });

    window.setTimeout(() => {
      frameWindow.focus();
      frameWindow.print();
      // Fallback cleanup for browsers that do not fire afterprint on frames.
      window.setTimeout(() => {
        if (document.body.contains(iframe)) iframe.remove();
      }, 60000);
    }, 150);
  };

  const handlePrint = async () => {
    if (!isApproved) {
      setPrintError('Printing is strictly restricted to APPROVED Bring Device Out requests.');
      return;
    }

    if (isReturnedOrClosed) {
      setPrintError('Cannot print sticker for devices that have already been Returned or Closed.');
      return;
    }

    setIsPrinting(true);
    setPrintError(null);
    setPrintSuccessMsg(null);

    try {
      // Build a completely isolated one-label document for the Windows/SATO
      // print dialog. This avoids printing the React application itself.
      const printHtml = buildSatoPrintHtml();

      const recordRes = await api.recordLabelPrint({
        requestId: request.id,
        templateId: template?.id,
        printedBy: currentUser?.id || 'admin',
        printedByName: currentUser?.name || 'Authorized Staff',
        printerName: printerName || 'SATO CL4NX (Windows Thermal)',
        printCount: (request.printCount || 0) + 1,
      });

      if (!recordRes.success) {
        throw new Error(recordRes.error || 'Server rejected sticker print recording.');
      }

      printSatoLabel(printHtml);

      setPrintSuccessMsg('SATO sticker opened in the Windows print dialog as one physical label.');

      if (recordRes.data) {
        setPrintHistory((prev) => [recordRes.data!, ...prev]);
      }

      if (onPrintSuccess) onPrintSuccess();
    } catch (err) {
      setPrintError(err instanceof Error ? err.message : 'Error executing print.');
    } finally {
      setIsPrinting(false);
    }
  };

  // Field mapper based on the request data
  const getFieldValue = (key: string): string => {
    switch (key) {
      case 'APPROVED':
        return 'BRING DEVICE OUT PASS';
      case 'request_number':
        return `REQ NO: ${request.requestId}`;
      case 'requester_name':
        return `Requestor: ${request.requesterName} (${request.departmentName || 'General'})`;
      case 'asset_name':
        return `Asset: ${request.assetName || request.serviceName}${request.serialNumber ? ` [SN: ${request.serialNumber}]` : ''}`;
      case 'from_date':
        return `From: ${request.fromDate ? new Date(request.fromDate).toLocaleDateString('en-GB') : '-'}`;
      case 'to_date':
        return `To: ${request.toDate ? new Date(request.toDate).toLocaleDateString('en-GB') : '-'}`;
      case 'approver_name':
        return `Approver: ${request.approvedByName || 'Authorized Approver'}`;
      case 'security_footer':
        return 'TANAKA IT OPS • STICKER MUST REMAIN AFFIXED • RETURN ON DUE DATE';
      case 'custom_text':
        return `VPN: ${request.vpnRequired ? 'Required' : 'Not Required'} • Purpose: ${request.businessPurpose ? request.businessPurpose.slice(0, 30) : '-'}`;
      default:
        return key;
    }
  };

  const widthMm = template?.widthMm || 100;
  const heightMm = template?.heightMm || 50;

  return (
    <>
      {/* Modal Dialog */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
        <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
          {/* Header */}
          <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-lg bg-indigo-600 text-white flex items-center justify-center shadow-xs">
                <Printer className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  SATO CL4NX Device Out Sticker
                </h3>
                <p className="text-xs text-slate-500">
                  Standard IT gate pass label for authorized equipment removal
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Body */}
          <div className="p-6 overflow-y-auto space-y-5">
            {/* Status notification banner */}
            {!isApproved ? (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold">Printing Restricted: </span>
                  This request has status <strong>{request.approvalStatus}</strong>.
                  Only requests with approval status <strong>Approved</strong> are permitted to print security stickers.
                </div>
              </div>
            ) : isReturnedOrClosed ? (
              <div className="p-3 bg-slate-100 border border-slate-300 rounded-lg text-xs text-slate-700 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold">Device Returned: </span>
                  This device has already been marked as Returned or Closed. Printing new stickers is locked.
                </div>
              </div>
            ) : (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-800 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                <div>
                  <strong>Authorized for Print:</strong> Approved by <strong>{request.approvedByName || 'Authorized Approver'}</strong> on{' '}
                  {request.approvedAt ? new Date(request.approvedAt).toLocaleString('en-GB') : 'Verified'}.
                </div>
              </div>
            )}

            {printError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{printError}</span>
              </div>
            )}

            {printSuccessMsg && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-700 flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{printSuccessMsg}</span>
              </div>
            )}

            {/* Label Template Selection */}
            {availableTemplates.length > 0 && (
              <div className="bg-slate-50 p-3.5 rounded-lg border border-slate-200">
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold text-slate-700">
                    Label Template Stock
                  </label>
                  <span className="text-[11px] text-slate-500 font-mono">
                    {widthMm}mm × {heightMm}mm ({template?.orientation || 'Landscape'})
                  </span>
                </div>
                <select
                  value={template?.id}
                  onChange={(e) => {
                    const found = availableTemplates.find((t) => t.id === e.target.value);
                    if (found) setTemplate(found);
                  }}
                  className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-md focus:ring-1 focus:ring-indigo-500 font-medium"
                >
                  {availableTemplates.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} — {t.widthMm}mm × {t.heightMm}mm{t.isActive ? ' ★ Default Active' : ''}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Sticker Live Preview Box */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Live Thermal Sticker Preview ({widthMm}mm × {heightMm}mm)
                </span>
                <span className="text-xs text-slate-500">
                  Total Prints: <span className="font-bold text-slate-800">{request.printCount || 0}</span>
                </span>
              </div>

              {/* Physical sticker rendering container */}
              <div className="bg-slate-100 p-4 rounded-lg flex items-center justify-center border border-slate-200 overflow-hidden">
                <div
                  id="sato-sticker-print-zone"
                  ref={stickerPrintRef}
                  className="bg-white border-2 border-black relative shadow-md select-none overflow-hidden"
                  style={{
                    width: '380px',
                    height: `${(380 * heightMm) / widthMm}px`,
                  }}
                >
                  {template?.elements && template.elements.length > 0 ? (
                    template.elements.map((el) => {
                      if (!el.visible) return null;
                      const val = el.fieldType === 'static' ? (el.staticText || '') : getFieldValue(el.fieldKey);
                      const elScale = 380 / widthMm;
                      return (
                        <div
                          key={el.id}
                          className="absolute flex items-center overflow-hidden leading-tight text-black"
                          style={{
                            left: `${el.xMm * elScale}px`,
                            top: `${el.yMm * elScale}px`,
                            width: `${el.widthMm * elScale}px`,
                            height: `${el.heightMm * elScale}px`,
                            transform: el.rotation ? `rotate(${el.rotation}deg)` : undefined,
                            fontSize: `${Math.max(8, el.fontSize * (elScale / 4.2))}px`,
                            fontWeight: el.fontWeight === 'bold' ? 700 : el.fontWeight === 'medium' ? 600 : 400,
                            justifyContent:
                              el.alignment === 'center'
                                ? 'center'
                                : el.alignment === 'right'
                                ? 'flex-end'
                                : 'flex-start',
                            textAlign: el.alignment,
                          }}
                        >
                          {el.elementType === 'badge' ? (
                            <div
                              className="w-full h-full bg-black text-white flex items-center justify-center font-bold tracking-wider rounded-[1px]"
                              style={{ fontSize: `${Math.max(9, el.fontSize * (elScale / 4.2))}px` }}
                            >
                              {val}
                            </div>
                          ) : (
                            <span className="truncate w-full">{val}</span>
                          )}
                        </div>
                      );
                    })
                  ) : (
                    /* Default standard gate pass fallback */
                    <div className="w-full h-full border border-black p-1.5 flex flex-col justify-between text-black">
                      <div className="bg-black text-white text-center font-black tracking-widest text-xs py-1 rounded-[1px]">
                        APPROVED FOR REMOVAL
                      </div>
                      <div className="space-y-1 text-[11px] leading-tight font-sans mt-1">
                        <div className="flex justify-between border-b border-black/30 pb-0.5">
                          <span className="font-bold">REQ: {request.requestId}</span>
                          <span className="font-mono text-[10px]">
                            {request.approvedAt ? new Date(request.approvedAt).toLocaleDateString('en-GB') : ''}
                          </span>
                        </div>
                        <div className="font-semibold truncate">
                          Requestor: <span className="font-bold">{request.requesterName}</span> ({request.departmentName || 'General'})
                        </div>
                        <div className="font-semibold truncate">
                          Asset: <span className="font-bold">{request.assetName || request.serviceName}</span>
                          {request.serialNumber && <span className="text-[10px] ml-1">[{request.serialNumber}]</span>}
                        </div>
                        <div className="flex justify-between text-[10px] bg-slate-100 px-1 py-0.5 rounded-[1px] border border-black/20 font-medium">
                          <span>From: <strong>{request.fromDate ? new Date(request.fromDate).toLocaleDateString('en-GB') : '-'}</strong></span>
                          <span>To: <strong>{request.toDate ? new Date(request.toDate).toLocaleDateString('en-GB') : '-'}</strong></span>
                        </div>
                        <div className="text-[10px] truncate text-slate-800">
                          Approved By: <strong>{request.approvedByName || 'Authorized Approver'}</strong>
                        </div>
                      </div>
                      <div className="border-t border-black pt-0.5 text-[8px] font-bold text-center tracking-tight uppercase">
                        TANAKA IT OPS • STICKER MUST REMAIN AFFIXED • SATO CL4NX
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Target Printer selection */}
            <div className="bg-slate-50 p-3.5 rounded-lg border border-slate-200">
              <label className="text-xs font-semibold text-slate-700 block mb-1.5">
                Target Windows Thermal Printer
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={printerName}
                  onChange={(e) => setPrinterName(e.target.value)}
                  placeholder="e.g. SATO CL4NX (Windows Driver)"
                  className="flex-1 px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-md focus:ring-1 focus:ring-indigo-500 font-mono"
                />
                <span className="text-[11px] text-slate-500 whitespace-nowrap">
                  (Uses OS print dialog)
                </span>
              </div>
              <p className="text-[11px] text-slate-500 mt-1.5">
                When you click <strong>Print Sticker</strong>, the browser opens the native Windows print dialog configured to <strong>{widthMm}mm × {heightMm}mm</strong>. Select your installed SATO CL4NX thermal label printer.
              </p>
            </div>

            {/* Audit Trail of Previous Prints */}
            {printHistory.length > 0 && (
              <div className="border-t border-slate-200 pt-3">
                <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 mb-2">
                  <History className="w-3.5 h-3.5 text-slate-500" />
                  Print Audit History ({printHistory.length})
                </div>
                <div className="space-y-1.5 max-h-32 overflow-y-auto">
                  {printHistory.map((h) => (
                    <div
                      key={h.id}
                      className="text-[11px] bg-slate-50 px-3 py-1.5 rounded border border-slate-200 flex items-center justify-between text-slate-600"
                    >
                      <div>
                        Printed by <span className="font-semibold text-slate-800">{h.printedByName || 'Authorized Staff'}</span> via {h.printerName || 'SATO CL4NX'}
                      </div>
                      <div className="font-mono text-slate-400">
                        {h.printedAt ? new Date(h.printedAt).toLocaleString('en-GB') : '-'}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Footer Buttons */}
          <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
            <button
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-100 transition-colors"
            >
              Close
            </button>

            <button
              onClick={handlePrint}
              disabled={isPrinting || !isApproved || isReturnedOrClosed}
              className={`flex items-center gap-2 px-5 py-2 text-xs font-bold text-white rounded-lg shadow-sm transition-colors ${
                isApproved && !isReturnedOrClosed
                  ? 'bg-indigo-600 hover:bg-indigo-700'
                  : 'bg-slate-300 cursor-not-allowed opacity-60'
              }`}
            >
              <Printer className="w-4 h-4" />
              {isPrinting ? 'Sending to Spooler...' : 'Print Sticker (SATO CL4NX)'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
};
