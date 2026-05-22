import QRCode from "qrcode";

export function renderLoginUrlQrPngBuffer(loginUrl: string, width: number): Promise<Buffer> {
  return QRCode.toBuffer(loginUrl, {
    type: "png",
    width,
    margin: 2,
    errorCorrectionLevel: "M",
    color: { dark: "#000000ff", light: "#ffffffff" },
  });
}
