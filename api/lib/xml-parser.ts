// Copiado de src/lib/xml-parser.ts para garantir que a função Vercel importe apenas arquivos locais à API.
import { DOMParser } from "@xmldom/xmldom"

export interface NFEData {
  tipo: "NFe" | "NFSe" | "Desconhecido"
  // Identificação
  numero: string
  serie: string
  dataEmissao: string
  horaEmissao: string
  dataEntradaSaida: string
  horaEntradaSaida: string
  chaveAcesso: string
  protocolo: string
  naturezaOperacao: string
  tipoOperacao: "0" | "1" // 0 = entrada, 1 = saída
  folha: string
  // Emitente
  emitente: {
    cnpj: string
    nome: string
    nomeFantasia: string
    endereco: string
    numero: string
    bairro: string
    cidade: string
    uf: string
    cep: string
    telefone: string
    inscricaoEstadual: string
    inscricaoEstadualST: string
  }
  // Destinatário
  destinatario: {
    cpfCnpj: string
    nome: string
    endereco: string
    numero: string
    bairro: string
    cidade: string
    uf: string
    cep: string
    telefone: string
    email: string
    inscricaoEstadual: string
  }
  // Transportador
  transportador: {
    nome: string
    cpfCnpj: string
    endereco: string
    cidade: string
    uf: string
    inscricaoEstadual: string
    fretePorConta: string
    codigoANTT: string
    placaVeiculo: string
    ufVeiculo: string
    quantidade: number
    especie: string
    marca: string
    numeracao: string
    pesoLiquido: number
    pesoBruto: number
  }
  // Produtos/Serviços
  itens: Array<{
    numero: string
    codigo: string
    descricao: string
    ncm: string
    cst: string
    cfop: string
    unidade: string
    quantidade: number
    valorUnitario: number
    valorTotal: number
    baseICMS: number
    valorICMS: number
    aliqICMS: number
    aliqIPI: number
    valorIPI: number
  }>
  // Cálculo do imposto
  impostos: {
    baseCalcICMS: number
    valorICMS: number
    baseCalcICMSST: number
    valorICMSST: number
    valorFrete: number
    valorSeguro: number
    desconto: number
    outrasDesp: number
    valorIPI: number
    valorProdutos: number
    valorTotal: number
  }
  // Fatura / Duplicatas
  fatura: {
    numero: string
    valorOriginal: number
    valorDesconto: number
    valorLiquido: number
  }
  duplicatas: Array<{
    numero: string
    vencimento: string
    valor: number
  }>
  // Informações adicionais
  informacoesComplementares: string
  informacoesFisco: string
}

function getTextContent(doc: Document, tagName: string, parent?: Element): string {
  const context = parent || doc
  const elements = context.getElementsByTagName(tagName)
  if (elements.length > 0 && elements[0].textContent) {
    return elements[0].textContent.trim()
  }
  return ""
}

function parseNumber(value: string): number {
  const num = parseFloat(value.replace(",", "."))
  return isNaN(num) ? 0 : num
}

export function parseNFE(xmlString: string): NFEData {
  const parser = new DOMParser()
  const doc = parser.parseFromString(xmlString, "text/xml")

  // Detectar tipo de documento
  const isNFe = doc.getElementsByTagName("NFe").length > 0 || doc.getElementsByTagName("nfeProc").length > 0
  const isNFSe =
    doc.getElementsByTagName("CompNfse").length > 0 || doc.getElementsByTagName("Nfse").length > 0

  const tipo = isNFe ? "NFe" : isNFSe ? "NFSe" : "Desconhecido"

  if (isNFe) {
    return parseNFeData(doc, tipo)
  } else if (isNFSe) {
    return parseNFSeData(doc, tipo)
  }

  return parseGenericData(doc, tipo)
}

function parseNFeData(doc: Document, tipo: "NFe" | "NFSe" | "Desconhecido"): NFEData {
  const ide = doc.getElementsByTagName("ide")[0]
  const emit = doc.getElementsByTagName("emit")[0]
  const dest = doc.getElementsByTagName("dest")[0]
  const total = doc.getElementsByTagName("total")[0]
  const transp = doc.getElementsByTagName("transp")[0]
  const cobr = doc.getElementsByTagName("cobr")[0]
  const infAdic = doc.getElementsByTagName("infAdic")[0]
  const protNFe = doc.getElementsByTagName("protNFe")[0]

  const dets = doc.getElementsByTagName("det")
  const itens: NFEData["itens"] = []

  for (let i = 0; i < dets.length; i++) {
    const det = dets[i]
    const prod = det.getElementsByTagName("prod")[0]
    const imposto = det.getElementsByTagName("imposto")[0]
    const icms = imposto?.getElementsByTagName("ICMS")[0]
    const ipi = imposto?.getElementsByTagName("IPI")[0]
    
    let icmsElement: Element | undefined
    if (icms) {
      const icmsTypes = ["ICMS00", "ICMS10", "ICMS20", "ICMS30", "ICMS40", "ICMS41", "ICMS50", "ICMS51", "ICMS60", "ICMS70", "ICMS90", "ICMSSN101", "ICMSSN102", "ICMSSN201", "ICMSSN202", "ICMSSN500", "ICMSSN900"]
      for (const icmsType of icmsTypes) {
        const found = icms.getElementsByTagName(icmsType)[0]
        if (found) {
          icmsElement = found
          break
        }
      }
    }

    let ipiElement: Element | undefined
    if (ipi) {
      ipiElement = ipi.getElementsByTagName("IPITrib")[0]
    }

    if (prod) {
      itens.push({
        numero: det.getAttribute("nItem") || String(i + 1),
        codigo: getTextContent(doc, "cProd", prod),
        descricao: getTextContent(doc, "xProd", prod),
        ncm: getTextContent(doc, "NCM", prod),
        cst: icmsElement ? (getTextContent(doc, "CST", icmsElement) || getTextContent(doc, "CSOSN", icmsElement)) : "",
        cfop: getTextContent(doc, "CFOP", prod),
        unidade: getTextContent(doc, "uCom", prod),
        quantidade: parseNumber(getTextContent(doc, "qCom", prod)),
        valorUnitario: parseNumber(getTextContent(doc, "vUnCom", prod)),
        valorTotal: parseNumber(getTextContent(doc, "vProd", prod)),
        baseICMS: icmsElement ? parseNumber(getTextContent(doc, "vBC", icmsElement)) : 0,
        valorICMS: icmsElement ? parseNumber(getTextContent(doc, "vICMS", icmsElement)) : 0,
        aliqICMS: icmsElement ? parseNumber(getTextContent(doc, "pICMS", icmsElement)) : 0,
        aliqIPI: ipiElement ? parseNumber(getTextContent(doc, "pIPI", ipiElement)) : 0,
        valorIPI: ipiElement ? parseNumber(getTextContent(doc, "vIPI", ipiElement)) : 0,
      })
    }
  }

  const enderEmit = emit?.getElementsByTagName("enderEmit")[0]
  const enderDest = dest?.getElementsByTagName("enderDest")[0]

  const transporta = transp?.getElementsByTagName("transporta")[0]
  const veicTransp = transp?.getElementsByTagName("veicTransp")[0]
  const vol = transp?.getElementsByTagName("vol")[0]

  const dups = cobr?.getElementsByTagName("dup") || []
  const duplicatas: NFEData["duplicatas"] = []
  for (let i = 0; i < dups.length; i++) {
    const dup = dups[i]
    duplicatas.push({
      numero: getTextContent(doc, "nDup", dup as Element),
      vencimento: formatDate(getTextContent(doc, "dVenc", dup as Element)),
      valor: parseNumber(getTextContent(doc, "vDup", dup as Element)),
    })
  }

  const dhEmi = getTextContent(doc, "dhEmi", ide) || getTextContent(doc, "dEmi", ide)
  const dhSaiEnt = getTextContent(doc, "dhSaiEnt", ide) || getTextContent(doc, "dSaiEnt", ide)
  
  return {
    tipo,
    numero: getTextContent(doc, "nNF", ide),
    serie: getTextContent(doc, "serie", ide),
    dataEmissao: formatDate(dhEmi),
    horaEmissao: formatTime(dhEmi),
    dataEntradaSaida: formatDate(dhSaiEnt),
    horaEntradaSaida: formatTime(dhSaiEnt) || formatTime(getTextContent(doc, "hSaiEnt", ide)),
    chaveAcesso: protNFe ? getTextContent(doc, "chNFe", protNFe as Element) : getTextContent(doc, "Id").replace("NFe", ""),
    protocolo: protNFe ? getTextContent(doc, "nProt", protNFe as Element) : "",
    naturezaOperacao: getTextContent(doc, "natOp", ide),
    tipoOperacao: (getTextContent(doc, "tpNF", ide) as "0" | "1") || "1",
    folha: "1/1",
    emitente: {
      cnpj: formatCNPJ(getTextContent(doc, "CNPJ", emit)),
      nome: getTextContent(doc, "xNome", emit),
      nomeFantasia: getTextContent(doc, "xFant", emit),
      endereco: getTextContent(doc, "xLgr", enderEmit),
      numero: getTextContent(doc, "nro", enderEmit),
      bairro: getTextContent(doc, "xBairro", enderEmit),
      cidade: getTextContent(doc, "xMun", enderEmit),
      uf: getTextContent(doc, "UF", enderEmit),
      cep: formatCEP(getTextContent(doc, "CEP", enderEmit)),
      telefone: formatPhone(getTextContent(doc, "fone", enderEmit)),
      inscricaoEstadual: getTextContent(doc, "IE", emit),
      inscricaoEstadualST: getTextContent(doc, "IEST", emit),
    },
    destinatario: {
      cpfCnpj: formatCPFCNPJ(
        getTextContent(doc, "CNPJ", dest) || getTextContent(doc, "CPF", dest)
      ),
      nome: getTextContent(doc, "xNome", dest),
      endereco: getTextContent(doc, "xLgr", enderDest),
      numero: getTextContent(doc, "nro", enderDest),
      bairro: getTextContent(doc, "xBairro", enderDest),
      cidade: getTextContent(doc, "xMun", enderDest),
      uf: getTextContent(doc, "UF", enderDest),
      cep: formatCEP(getTextContent(doc, "CEP", enderDest)),
      telefone: formatPhone(getTextContent(doc, "fone", enderDest)),
      email: getTextContent(doc, "email", dest),
      inscricaoEstadual: getTextContent(doc, "IE", dest),
    },
    transportador: {
      nome: transporta ? getTextContent(doc, "xNome", transporta) : "",
      cpfCnpj: transporta ? formatCPFCNPJ(getTextContent(doc, "CNPJ", transporta) || getTextContent(doc, "CPF", transporta)) : "",
      endereco: transporta ? getTextContent(doc, "xEnder", transporta) : "",
      cidade: transporta ? getTextContent(doc, "xMun", transporta) : "",
      uf: transporta ? getTextContent(doc, "UF", transporta) : "",
      inscricaoEstadual: transporta ? getTextContent(doc, "IE", transporta) : "",
      fretePorConta: getTextContent(doc, "modFrete", transp),
      codigoANTT: veicTransp ? getTextContent(doc, "RNTC", veicTransp) : "",
      placaVeiculo: veicTransp ? getTextContent(doc, "placa", veicTransp) : "",
      ufVeiculo: veicTransp ? getTextContent(doc, "UF", veicTransp) : "",
      quantidade: vol ? parseNumber(getTextContent(doc, "qVol", vol as Element)) : 0,
      especie: vol ? getTextContent(doc, "esp", vol as Element) : "",
      marca: vol ? getTextContent(doc, "marca", vol as Element) : "",
      numeracao: vol ? getTextContent(doc, "nVol", vol as Element) : "",
      pesoLiquido: vol ? parseNumber(getTextContent(doc, "pesoL", vol as Element)) : 0,
      pesoBruto: vol ? parseNumber(getTextContent(doc, "pesoB", vol as Element)) : 0,
    },
    itens,
    impostos: {
      baseCalcICMS: parseNumber(getTextContent(doc, "vBC", total)),
      valorICMS: parseNumber(getTextContent(doc, "vICMS", total)),
      baseCalcICMSST: parseNumber(getTextContent(doc, "vBCST", total)),
      valorICMSST: parseNumber(getTextContent(doc, "vST", total)),
      valorFrete: parseNumber(getTextContent(doc, "vFrete", total)),
      valorSeguro: parseNumber(getTextContent(doc, "vSeg", total)),
      desconto: parseNumber(getTextContent(doc, "vDesc", total)),
      outrasDesp: parseNumber(getTextContent(doc, "vOutro", total)),
      valorIPI: parseNumber(getTextContent(doc, "vIPI", total)),
      valorProdutos: parseNumber(getTextContent(doc, "vProd", total)),
      valorTotal: parseNumber(getTextContent(doc, "vNF", total)),
    },
    fatura: cobr ? {
      numero: getTextContent(doc, "nFat", cobr.getElementsByTagName("fat")[0] as Element),
      valorOriginal: parseNumber(getTextContent(doc, "vOrig", cobr.getElementsByTagName("fat")[0] as Element)),
      valorDesconto: parseNumber(getTextContent(doc, "vDesc", cobr.getElementsByTagName("fat")[0] as Element)),
      valorLiquido: parseNumber(getTextContent(doc, "vLiq", cobr.getElementsByTagName("fat")[0] as Element)),
    } : {
      numero: "",
      valorOriginal: 0,
      valorDesconto: 0,
      valorLiquido: 0,
    },
    duplicatas,
    informacoesComplementares: infAdic ? getTextContent(doc, "infCpl", infAdic as Element) : "",
    informacoesFisco: infAdic ? getTextContent(doc, "infAdFisco", infAdic as Element) : "",
  }
}

function parseNFSeData(doc: Document, tipo: "NFe" | "NFSe" | "Desconhecido"): NFEData {
  const infNfse = doc.getElementsByTagName("InfNfse")[0]
  const prestador = doc.getElementsByTagName("PrestadorServico")[0] || doc.getElementsByTagName("Prestador")[0]
  const tomador = doc.getElementsByTagName("TomadorServico")[0] || doc.getElementsByTagName("Tomador")[0]
  const servico = doc.getElementsByTagName("Servico")[0]
  const valores = doc.getElementsByTagName("Valores")[0]

  const enderecoPrestador = prestador?.getElementsByTagName("Endereco")[0]
  const enderecoTomador = tomador?.getElementsByTagName("Endereco")[0]
  const identificacaoTomador = tomador?.getElementsByTagName("IdentificacaoTomador")[0]

  const valorServicos = parseNumber(getTextContent(doc, "ValorServicos", valores))
  
  return {
    tipo,
    numero: getTextContent(doc, "Numero", infNfse),
    serie: getTextContent(doc, "Serie", infNfse) || "1",
    dataEmissao: formatDate(getTextContent(doc, "DataEmissao", infNfse)),
    horaEmissao: formatTime(getTextContent(doc, "DataEmissao", infNfse)),
    dataEntradaSaida: "",
    horaEntradaSaida: "",
    chaveAcesso: getTextContent(doc, "CodigoVerificacao", infNfse),
    protocolo: "",
    naturezaOperacao: "Prestacao de Servicos",
    tipoOperacao: "1",
    folha: "1/1",
    emitente: {
      cnpj: formatCNPJ(getTextContent(doc, "Cnpj", prestador)),
      nome: getTextContent(doc, "RazaoSocial", prestador),
      nomeFantasia: getTextContent(doc, "NomeFantasia", prestador),
      endereco: getTextContent(doc, "Endereco", enderecoPrestador),
      numero: getTextContent(doc, "Numero", enderecoPrestador),
      bairro: getTextContent(doc, "Bairro", enderecoPrestador),
      cidade: getTextContent(doc, "Municipio", enderecoPrestador) || getTextContent(doc, "CodigoMunicipio", enderecoPrestador),
      uf: getTextContent(doc, "Uf", enderecoPrestador),
      cep: formatCEP(getTextContent(doc, "Cep", enderecoPrestador)),
      telefone: formatPhone(getTextContent(doc, "Telefone", prestador)),
      inscricaoEstadual: getTextContent(doc, "InscricaoMunicipal", prestador),
      inscricaoEstadualST: "",
    },
    destinatario: {
      cpfCnpj: formatCPFCNPJ(
        getTextContent(doc, "Cnpj", identificacaoTomador) || getTextContent(doc, "Cpf", identificacaoTomador)
      ),
      nome: getTextContent(doc, "RazaoSocial", tomador),
      endereco: getTextContent(doc, "Endereco", enderecoTomador),
      numero: getTextContent(doc, "Numero", enderecoTomador),
      bairro: getTextContent(doc, "Bairro", enderecoTomador),
      cidade: getTextContent(doc, "Municipio", enderecoTomador) || getTextContent(doc, "CodigoMunicipio", enderecoTomador),
      uf: getTextContent(doc, "Uf", enderecoTomador),
      cep: formatCEP(getTextContent(doc, "Cep", enderecoTomador)),
      telefone: formatPhone(getTextContent(doc, "Telefone", tomador)),
      email: getTextContent(doc, "Email", tomador),
      inscricaoEstadual: "",
    },
    transportador: {
      nome: "",
      cpfCnpj: "",
      endereco: "",
      cidade: "",
      uf: "",
      inscricaoEstadual: "",
      fretePorConta: "",
      codigoANTT: "",
      placaVeiculo: "",
      ufVeiculo: "",
      quantidade: 0,
      especie: "",
      marca: "",
      numeracao: "",
      pesoLiquido: 0,
      pesoBruto: 0,
    },
    itens: [
      {
        numero: "1",
        codigo: getTextContent(doc, "ItemListaServico", servico),
        descricao: getTextContent(doc, "Discriminacao", servico),
        ncm: "",
        cst: "",
        cfop: "",
        unidade: "SV",
        quantidade: 1,
        valorUnitario: valorServicos,
        valorTotal: valorServicos,
        baseICMS: 0,
        valorICMS: 0,
        aliqICMS: 0,
        aliqIPI: 0,
        valorIPI: 0,
      },
    ],
    impostos: {
      baseCalcICMS: 0,
      valorICMS: 0,
      baseCalcICMSST: 0,
      valorICMSST: 0,
      valorFrete: 0,
      valorSeguro: 0,
      desconto: parseNumber(getTextContent(doc, "DescontoIncondicionado", valores)),
      outrasDesp: 0,
      valorIPI: 0,
      valorProdutos: valorServicos,
      valorTotal: parseNumber(getTextContent(doc, "ValorLiquidoNfse", valores)) || valorServicos,
    },
    fatura: {
      numero: "",
      valorOriginal: 0,
      valorDesconto: 0,
      valorLiquido: 0,
    },
    duplicatas: [],
    informacoesComplementares: getTextContent(doc, "Discriminacao", servico),
    informacoesFisco: "",
  }
}

function parseGenericData(doc: Document, tipo: "NFe" | "NFSe" | "Desconhecido"): NFEData {
  return {
    tipo,
    numero: "",
    serie: "",
    dataEmissao: new Date().toLocaleDateString("pt-BR"),
    horaEmissao: "",
    dataEntradaSaida: "",
    horaEntradaSaida: "",
    chaveAcesso: "",
    protocolo: "",
    naturezaOperacao: "",
    tipoOperacao: "1",
    folha: "1/1",
    emitente: {
      cnpj: "",
      nome: "",
      nomeFantasia: "",
      endereco: "",
      numero: "",
      bairro: "",
      cidade: "",
      uf: "",
      cep: "",
      telefone: "",
      inscricaoEstadual: "",
      inscricaoEstadualST: "",
    },
    destinatario: {
      cpfCnpj: "",
      nome: "",
      endereco: "",
      numero: "",
      bairro: "",
      cidade: "",
      uf: "",
      cep: "",
      telefone: "",
      email: "",
      inscricaoEstadual: "",
    },
    transportador: {
      nome: "",
      cpfCnpj: "",
      endereco: "",
      cidade: "",
      uf: "",
      inscricaoEstadual: "",
      fretePorConta: "",
      codigoANTT: "",
      placaVeiculo: "",
      ufVeiculo: "",
      quantidade: 0,
      especie: "",
      marca: "",
      numeracao: "",
      pesoLiquido: 0,
      pesoBruto: 0,
    },
    itens: [],
    impostos: {
      baseCalcICMS: 0,
      valorICMS: 0,
      baseCalcICMSST: 0,
      valorICMSST: 0,
      valorFrete: 0,
      valorSeguro: 0,
      desconto: 0,
      outrasDesp: 0,
      valorIPI: 0,
      valorProdutos: 0,
      valorTotal: 0,
    },
    fatura: {
      numero: "",
      valorOriginal: 0,
      valorDesconto: 0,
      valorLiquido: 0,
    },
    duplicatas: [],
    informacoesComplementares: "",
    informacoesFisco: "",
  }
}

function formatDate(dateStr: string): string {
  if (!dateStr) return ""
  try {
    const date = new Date(dateStr)
    return date.toLocaleDateString("pt-BR")
  } catch {
    return dateStr
  }
}

function formatTime(dateStr: string): string {
  if (!dateStr) return ""
  try {
    const date = new Date(dateStr)
    return date.toLocaleTimeString("pt-BR")
  } catch {
    return ""
  }
}

function formatCNPJ(cnpj: string): string {
  if (!cnpj) return ""
  const cleaned = cnpj.replace(/\D/g, "")
  if (cleaned.length !== 14) return cnpj
  return cleaned.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5")
}

function formatCPFCNPJ(value: string): string {
  if (!value) return ""
  const cleaned = value.replace(/\D/g, "")
  if (cleaned.length === 11) {
    return cleaned.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4")
  }
  if (cleaned.length === 14) {
    return formatCNPJ(value)
  }
  return value
}

function formatCEP(cep: string): string {
  if (!cep) return ""
  const cleaned = cep.replace(/\D/g, "")
  if (cleaned.length !== 8) return cep
  return cleaned.replace(/(\d{5})(\d{3})/, "$1-$2")
}

function formatPhone(phone: string): string {
  if (!phone) return ""
  const cleaned = phone.replace(/\D/g, "")
  if (cleaned.length === 10) {
    return cleaned.replace(/(\d{2})(\d{4})(\d{4})/, "($1) $2-$3")
  }
  if (cleaned.length === 11) {
    return cleaned.replace(/(\d{2})(\d{5})(\d{4})/, "($1) $2-$3")
  }
  return phone
}
