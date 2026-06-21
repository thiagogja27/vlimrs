import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";
import { PDFParse } from "pdf-parse";
import { parseDanfeText } from "./src/lib/pdf-text-parser";

dotenv.config();

const app = express();
const PORT = 3000;

// Configurar o parser para aumentar o limite do tamanho dos corpos JSON (PDFs codificados em base64)
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// Endpoint da API para converter PDF em XML de NF-e usando apenas parser local
app.post("/api/pdf-to-xml", async (req, res) => {
  try {
    const { fileBase64, fileName } = req.body;

    if (!fileBase64) {
      return res.status(400).json({ error: "Nenhum arquivo PDF enviado no corpo da requisição." });
    }

    const pdfBuffer = Buffer.from(fileBase64, "base64");
    const parser = new PDFParse({ data: pdfBuffer });
    try {
      const textResult = await parser.getText();
      const text = textResult.text;

      const { xml, data } = parseDanfeText(text, fileName);
      return res.status(200).json({
        xml,
        fileName: fileName ? fileName.replace(/\.pdf$/i, ".xml") : "convertido.xml",
        parsedData: data,
      });
    } finally {
      await parser.destroy();
    }

    const ai = getGeminiClient();

    const pdfPart = {
      inlineData: {
        mimeType: "application/pdf",
        data: fileBase64,
      },
    };

    const promptText = `
Você é um conversor de DANFE (Documento Auxiliar de Nota Fiscal Eletrônica de mercadorias no Brasil) altamente especializado.
Por favor, analise as páginas deste documento PDF e extraia TODOS os dados necessários para gerar um arquivo XML correspondente à Nota Fiscal Eletrônica (NF-e) seguindo RGIDAMENTE o padrão nacional de NF-e da Sefaz.

INSTRUÇÕES CRÍTICAS DE ESTRUTURA XML:
1. Retorne APENAS o código XML puro estruturado.
2. NÃO adicione nenhum delimitador Markdown ao redor do XML, nem coloque \`\`\`xml ou \`\`\`. Comece diretamente com os nós do XML.
3. Se houver caracteres acentuados ou especiais, garanta que o XML retornado esteja em UTF-8 bem formatado.
4. O XML deve seguir exatamente esta estrutura de exemplo fornecida pelo usuário:

<nfeProc xmlns="http://www.portalfiscal.inf.br/nfe" versao="4.00">
  <NFe>
    <infNFe Id="NFe[ChaveDeAcessoDe44Digitos]" versao="4.00">
      <ide>
        <cUF>[Código da UF, ex: 52]</cUF>
        <cNF>[Código Numérico Aleatório de 8 dígitos]</cNF>
        <natOp>[Natureza da Operação, ex: REMESSA PARA FORMACAO DE LOTE DE EXPORTACAO]</natOp>
        <mod>55</mod>
        <serie>[Série da nota, ex: 28]</serie>
        <nNF>[Número da nota fiscal, ex: 402428]</nNF>
        <dhEmi>[Data e hora de emissor no formato ISO-8601, ex: 2026-05-25T13:24:00-03:00]</dhEmi>
        <tpNF>1</tpNF>
        <idDest>2</idDest>
        <cMunFG>[Código do Município do Fato Gerador]</cMunFG>
        <tpImp>1</tpImp>
        <tpEmis>1</tpEmis>
        <cDV>[Dígito Verificador da Chave de Acesso]</cDV>
        <tpAmb>1</tpAmb>
        <finNFe>1</finNFe>
        <indFinal>0</indFinal>
        <indPres>1</indPres>
        <procEmi>0</procEmi>
        <verProc>1.0</verProc>
      </ide>
      <emit>
        <CNPJ>[Apenas os números do CNPJ do emitente]</CNPJ>
        <xNome>[Razão Social do emitente]</xNome>
        <xFant>[Nome Fantasia do emitente]</xFant>
        <enderEmit>
          <xLgr>[Logradouro]</xLgr>
          <nro>[Número]</nro>
          <xBairro>[Bairro]</xBairro>
          <cMun>[Código do município]</cMun>
          <xMun>[Nome do município]</xMun>
          <UF>[Estado/UF]</UF>
          <CEP>[CEP sem traço]</CEP>
          <cPais>1058</cPais>
          <xPais>BRASIL</xPais>
          <fone>[Telefone, se houver]</fone>
        </enderEmit>
        <IE>[Inscrição Estadual]</IE>
      </emit>
      <dest>
        <CNPJ>[CNPJ do destinatário, apenas números. Se for pessoa física, use <CPF>]</CNPJ>
        <xNome>[Razão Social / Nome do destinatário]</xNome>
        <enderDest>
          <xLgr>[Logradouro]</xLgr>
          <nro>[Número]</nro>
          <xBairro>[Bairro]</xBairro>
          <cMun>[Código município destinatário]</cMun>
          <xMun>[Nome município destinatário]</xMun>
          <UF>[Estado/UF destinatário]</UF>
          <CEP>[CEP destinatário]</CEP>
          <cPais>1058</cPais>
          <xPais>BRASIL</xPais>
        </enderDest>
        <indIEDest>1</indIEDest>
        <IE>[Inscrição Estadual destinatário, se aplicável]</IE>
      </dest>
      <det nItem="1">
        <prod>
          <cProd>[Código do produto]</cProd>
          <cEAN>SEM GTIN</cEAN>
          <xProd>[Nome/Descrição do Produto, ex: SOJA GRAOS, MILHO BRANCO]</xProd>
          <NCM>[Código NCM, apenas números]</NCM>
          <CFOP>[Código CFOP, apenas números]</CFOP>
          <uCom>[Unidade de Medida Comercial, ex: TON, KG, SC]</uCom>
          <qCom>[Quantidade Comercial, ex: 70.0000]</qCom>
          <vUnCom>[Valor Unitário da Unidade Comercial, ex: 1923.5700]</vUnCom>
          <vProd>[Valor Total do Produto, ex: 134649.90]</vProd>
          <cEANTrib>SEM GTIN</cEANTrib>
          <uTrib>[Unidade Tributada]</uTrib>
          <qTrib>[Quantidade Tributada]</qTrib>
          <vUnTrib>[Valor unitário de tributação]</vUnTrib>
          <indTot>1</indTot>
        </prod>
        <imposto>
          <ICMS>
            <ICMS40>
              <orig>0</orig>
              <CST>41</CST>
            </ICMS40>
          </ICMS>
          <IPI>
            <cEnq>999</cEnq>
            <IPINT>
              <CST>53</CST>
            </IPINT>
          </IPI>
          <PIS>
            <PISNT>
              <CST>08</CST>
            </PISNT>
          </PIS>
          <COFINS>
            <COFINSNT>
              <CST>08</CST>
            </COFINSNT>
          </COFINS>
        </imposto>
      </det>
      <total>
        <ICMSTot>
          <vBC>[Base Cálculo ICMS, ex: 0.00]</vBC>
          <vICMS>[Valor ICMS, ex: 0.00]</vICMS>
          <vICMSDeson>0.00</vICMSDeson>
          <vFCP>0.00</vFCP>
          <vBCST>0.00</vBCST>
          <vST>0.00</vST>
          <vFCPST>0.00</vFCPST>
          <vFCPSTRet>0.00</vFCPSTRet>
          <vProd>[Soma do valor total de produtos, ex: 134649.90]</vProd>
          <vFrete>[Valor frete, se houver]</vFrete>
          <vSeg>[Valor seguro, se houver]</vSeg>
          <vDesc>[Valor desconto, se houver]</vDesc>
          <vII>0.00</vII>
          <vIPI>0.00</vIPI>
          <vIPIDevol>0.00</vIPIDevol>
          <vPIS>0.00</vPIS>
          <vCOFINS>0.00</vCOFINS>
          <vOutro>[Valor outras despesas acessórias]</vOutro>
          <vNF>[Valor total líquido da nota - vProd + vFrete + vSeg + vOutro - vDesc]</vNF>
          <vTotTrib>0.00</vTotTrib>
        </ICMSTot>
      </total>
      <transp>
        <modFrete>[Código modalidade frete, ex: 0 ou 1]</modFrete>
        <transporta>
          <CNPJ>[CNPJ Transportadora, apenas números]</CNPJ>
          <xNome>[Razão Social Transportadora]</xNome>
          <IE>[Inscrição Estadual Transportadora]</IE>
          <xEnder>[Endereço Transportadora]</xEnder>
          <xMun>[Município Transportadora]</xMun>
          <UF>[Estado/UF Transportadora]</UF>
        </transporta>
        <vol>
          <qVol>[Quantidade de volumes, ex: 1]</qVol>
          <esp>[Espécie de volumes, ex: KG, BIG BAG, GRANEL]</esp>
          <pesoL>[Peso Líquido Total]</pesoL>
          <pesoB>[Peso Bruto Total]</pesoB>
        </vol>
      </transp>
      <infAdic>
        <infCpl>[Texto livre de informações adicionais/complementares da nota. 
        MUITO IMPORTANTE: se no texto de informações complementares, observações ou corpo da nota houver menção aos locais de RETIRADA, locais de TRANSBORDO ou TERMINAL DE ENTREGA, você DEVE extrair esses locais e estruturá-los explicitamente dentro desta tag como:
        "RETIRADA EM: [Local]; TRANSBORDO EM: [Local]; TERMINAL DE ENTREGA: [Local];"
        Por exemplo: "RETIRADA EM: LOUIS DREYFUS COMPANY BRASIL S A - SAO SIMAO, GO; TRANSBORDO EM: LOUIS DREYFUS COMPANY BRASIL S A - PEDERNEIRAS, SP; TERMINAL DE ENTREGA: COMPANHIA AUX DE ARMAZENS GERAIS - SANTOS, SP;"
        Mantendo essa nomenclatura e separadores por ponto e vírgula, pois nosso painel logístico depende vitalmente desta estrutura de texto na tag infCpl para rastreio!]</infCpl>
      </infAdic>
    </infNFe>
  </NFe>
</nfeProc>

INSTRUÇÕES DE EXTRAÇÃO ADICIONAIS:
- Extraia múltiplos itens na tabela de mercadorias adicionando múltiplos blocos <det nItem="1">, <det nItem="2">, etc. caso haja mais de 1 item listado.
- Calcule a Chave de Acesso de maneira realista. A chave deve ter 44 dígitos numéricos, começar pela UF apropriada, e deve ser inserida sem espaços ou hifens no Id da tag <infNFe Id="NFe[Chave]">.
- Mantenha os valores decimais formatados com ponto (ex: 134649.90, e não 134649,90).
- Garanta que TODAS as tags XML de fechamento correspondam exatamente às tags de abertura.
- Não inclua nenhuma introdução ou notas explicativas, apenas retorne o XML limpo contendo as informações lidas do PDF.
`;

  } catch (err: any) {
    console.error("Erro ao converter PDF para XML:", err);
    return res.status(500).json({ error: err.message || "Erro desconhecido ao converter PDF para XML." });
  }
});

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
