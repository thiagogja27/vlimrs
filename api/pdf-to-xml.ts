import { PDFParse } from "pdf-parse";
import { parseDanfeText } from "../src/lib/pdf-text-parser";

async function parseRequestBody(req: import("http").IncomingMessage) {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }
  const bodyText = Buffer.concat(chunks).toString("utf-8");
  return JSON.parse(bodyText || "{}");
}

export const config = {
  runtime: "nodejs",
};

export default async function handler(
  req: import("http").IncomingMessage & { method?: string },
  res: import("http").ServerResponse
) {
  if (req.method !== "POST") {
    res.statusCode = 405;
    res.setHeader("Allow", "POST");
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ error: "Method not allowed" }));
    return;
  }

  try {
    const body = await parseRequestBody(req);
    const { fileBase64, fileName } = body as { fileBase64?: string; fileName?: string };

    if (!fileBase64) {
      res.statusCode = 400;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ error: "Nenhum arquivo PDF enviado no corpo da requisição." }));
      return;
    }

    const pdfBuffer = Buffer.from(fileBase64, "base64");
    const parser = new PDFParse({ data: pdfBuffer });

    try {
      const textResult = await parser.getText();
      const text = textResult.text;
      const { xml, data } = parseDanfeText(text, fileName);

      res.statusCode = 200;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({
        xml,
        fileName: fileName ? fileName.replace(/\.pdf$/i, ".xml") : "convertido.xml",
        parsedData: data,
      }));
    } finally {
      await parser.destroy();
    }
  } catch (err: any) {
    console.error("Erro na API /api/pdf-to-xml:", err);
    res.statusCode = 500;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ error: err.message || "Erro desconhecido ao converter PDF para XML." }));
  }
}
