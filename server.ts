import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";
import { PDFParse } from "pdf-parse";
import { parseDanfeText } from "./src/lib/pdf-text-parser";
import { parseNFE } from "./src/lib/xml-parser";

dotenv.config();

const app = express();
const PORT = 3000;

// Configurar o parser para aumentar o limite do tamanho dos corpos JSON (PDFs codificados em base64)
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// Endpoint da API para converter PDF em XML de NF-e usando parser XML robusto
app.post(
  "/api/pdf-to-xml",
  express.raw({ type: "application/pdf", limit: "50mb" }),
  async (req, res) => {
    try {
      let fileName = String(req.headers["x-file-name"] || "");
      let pdfBuffer: Buffer | null = null;

      if (req.is("application/pdf")) {
        pdfBuffer = req.body as Buffer;
      } else {
        const { fileBase64, fileName: jsonFileName } = req.body;
        fileName = fileName || jsonFileName || fileName;
        if (!fileBase64) {
          return res.status(400).json({ error: "Nenhum arquivo PDF enviado no corpo da requisição." });
        }
        pdfBuffer = Buffer.from(fileBase64, "base64");
      }

      const parser = new PDFParse({ data: pdfBuffer });
      try {
        const textResult = await parser.getText();
        const text = textResult.text;

        // Tentar extrair XML do PDF
        let xmlString = extractXMLFromPDF(text);

        // Se não encontrou XML, tenta fazer parsing do texto usando heurística
        if (!xmlString) {
          const { xml, data } = parseDanfeText(text, fileName);
          return res.status(200).json({
            xml,
            fileName: fileName ? fileName.replace(/\.pdf$/i, ".xml") : "convertido.xml",
            parsedData: data,
            source: "text_parser"
          });
        }

        // Se encontrou XML, fazer parsing estruturado
        const parsedData = parseNFE(xmlString);
        return res.status(200).json({
          xml: xmlString,
          fileName: fileName ? fileName.replace(/\.pdf$/i, ".xml") : "convertido.xml",
          parsedData,
          source: "xml_parser"
        });
      } finally {
        await parser.destroy();
      }
    } catch (err: any) {
      console.error("Erro ao converter PDF para XML:", err);
      return res.status(500).json({ error: err.message || "Erro desconhecido ao converter PDF para XML." });
    }
  }
);

// Função para extrair XML embutido no PDF
function extractXMLFromPDF(text: string): string | null {
  // Procurar por tags XML: <nfeProc>, <NFe>, <CompNfse>, <Nfse>
  const xmlPatterns = [
    /<nfeProc[\s\S]*?<\/nfeProc>/i,
    /<NFe[\s\S]*?<\/NFe>/i,
    /<CompNfse[\s\S]*?<\/CompNfse>/i,
    /<Nfse[\s\S]*?<\/Nfse>/i,
  ];

  for (const pattern of xmlPatterns) {
    const match = text.match(pattern);
    if (match) {
      return match[0];
    }
  }

  return null;
}

// Configurar o Vite como middleware para servir a aplicação React em desenvolvimento
// Em produção, servirá os arquivos estáticos compilados na pasta 'dist'
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[Server] Rodando em http://localhost:${PORT}`);
  });
}

startServer();
