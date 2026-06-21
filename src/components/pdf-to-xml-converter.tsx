'use client'

import React, { useState, useCallback } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  FileText,
  Upload,
  Download,
  AlertCircle,
  CheckCircle2,
  X,
  Loader2,
  ChevronDown,
  ChevronUp,
  FileCode,
  ArrowRight,
  Sparkles,
  FileSpreadsheet,
} from 'lucide-react'
import JSZip from 'jszip'
import * as XLSX from 'xlsx'

interface PDFConversionResult {
  fileName: string
  xmlContent: string | null
  error: string | null
  isProcessing: boolean
  parsedData?: any
}

interface PDFToXMLConverterProps {
  onAnalyzeXML: (fileName: string, xmlContent: string) => void
}

export function PDFToXMLConverter({ onAnalyzeXML }: PDFToXMLConverterProps) {
  const [results, setResults] = useState<PDFConversionResult[]>([])
  const [isDragOver, setIsDragOver] = useState(false)
  const [isProcessingAll, setIsProcessingAll] = useState(false)
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null)
  
  const fileInputRef = React.useRef<HTMLInputElement>(null)
  const folderInputRef = React.useRef<HTMLInputElement>(null)

  // Função auxiliar para converter arquivos para Base64 de forma assíncrona
  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.readAsDataURL(file)
      reader.onload = () => {
        const base64String = reader.result as string
        // Remove o prefixo ex: "data:application/pdf;base64,"
        const cleanBase64 = base64String.split(',')[1]
        resolve(cleanBase64)
      }
      reader.onerror = (error) => reject(error)
    })
  }

  const convertSinglePDF = async (file: File): Promise<PDFConversionResult> => {
    try {
      const response = await fetch('/api/pdf-to-xml', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/pdf',
          'x-file-name': file.name,
        },
        body: file,
      })

      const responseText = await response.text()
      let data
      try {
        data = JSON.parse(responseText)
      } catch (parseError) {
        throw new Error(`Resposta inválida do servidor: ${responseText}`)
      }

      if (!response.ok) {
        throw new Error(data.error || 'Erro inesperado ao converter PDF para XML')
      }

      return {
        fileName: file.name,
        xmlContent: data.xml,
        error: null,
        isProcessing: false,
        parsedData: data.parsedData, // Store parsedData for excel download
      }
    } catch (err: any) {
      console.error(`Erro ao converter ${file.name}:`, err)
      return {
        fileName: file.name,
        xmlContent: null,
        error: err.message || 'Falha ao conectar ao servidor de conversão.',
        isProcessing: false,
      }
    }
  }

  const processPDFs = useCallback(async (selectedFiles: FileList) => {
    const pdfFiles = Array.from(selectedFiles).filter(f => f.name.toLowerCase().endsWith('.pdf'))
    if (pdfFiles.length === 0) {
      alert('Nenhum arquivo PDF encontrado na seleção/pasta.')
      return
    }

    setIsProcessingAll(true)
    setExpandedIndex(null)

    // Inicializa a lista de resultados com estado processando
    const initialResults: PDFConversionResult[] = pdfFiles.map(file => ({
      fileName: file.name,
      xmlContent: null,
      error: null,
      isProcessing: true,
    }))

    setResults(initialResults)

    const resultsState = [...initialResults]
    const queue = pdfFiles.map((file, originalIndex) => ({ file, originalIndex }))
    const activeWorkers: Promise<void>[] = []

    const runWorker = async () => {
      while (queue.length > 0) {
        const task = queue.shift()
        if (!task) break
        const { file, originalIndex } = task

        const result = await convertSinglePDF(file)
        resultsState[originalIndex] = result
        setResults([...resultsState])
      }
    }

    // Gerar até 3 instâncias de workers em paralelo
    const workerCount = Math.min(3, queue.length)
    for (let i = 0; i < workerCount; i++) {
      activeWorkers.push(runWorker())
    }

    await Promise.all(activeWorkers)
    setIsProcessingAll(false)
  }, [])

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(true)
  }

  const handleDragLeave = () => {
    setIsDragOver(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
    if (e.dataTransfer.files) {
      processPDFs(e.dataTransfer.files)
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processPDFs(e.target.files)
    }
  }

  const handleDownloadSingleXML = (result: PDFConversionResult) => {
    if (!result.xmlContent) return
    const blob = new Blob([result.xmlContent], { type: 'text/xml' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = result.fileName.replace(/\.pdf$/i, '.xml')
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const handleDownloadAllZIP = async () => {
    const activexmls = results.filter(r => r.xmlContent)
    if (activexmls.length === 0) return

    const zip = new JSZip()
    activexmls.forEach((res) => {
      if (res.xmlContent) {
        zip.file(res.fileName.replace(/\.pdf$/i, '.xml'), res.xmlContent)
      }
    })

    const content = await zip.generateAsync({ type: 'blob' })
    const url = URL.createObjectURL(content)
    const a = document.createElement('a')
    a.href = url
    a.download = 'xml_convertidos_nfe.zip'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const handleDownloadAllExcel = () => {
    const activeResults = results.filter(r => r.xmlContent && r.parsedData)
    if (activeResults.length === 0) {
      alert('Nenhuma nota convertida com sucesso para exportar para o Excel.')
      return
    }

    const dataRows = activeResults.map((res) => {
      const d = res.parsedData
      return {
        'Arquivo PDF': res.fileName,
        'Nº Nota (nNF)': d.nNF || '',
        'Série': d.serie || '',
        'Chave de Acesso': d.chave || '',
        'Emitente': d.emitNome || '',
        'CNPJ Emitente': d.emitCNPJ || '',
        'Destinatário': d.destNome || '',
        'CNPJ Destinatário': d.destCNPJ || '',
        'Mercadoria': d.prodNome || '',
        'CFOP': d.prodCFOP || '',
        'Quantidade (Comercial)': d.prodQCom || 0,
        'Valor Unitário': d.prodVUnCom || 0,
        'Valor Mercadorias': d.prodVProd || 0,
        'Local Retirada': d.retirada || '',
        'Local Transbordo': d.transbordo || '',
        'Terminal de Entrega': d.terminalEntrega || '',
        'Valor Total Nota (R$)': d.vNF || '',
      }
    })

    const worksheet = XLSX.utils.json_to_sheet(dataRows)
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Notas Convertidas')

    // Ajustar larguras das colunas do excel de forma simples
    const max_len = dataRows.reduce((w: any, r: any) => {
      Object.keys(r).forEach((key, idx) => {
        const val = String(r[key]);
        w[idx] = Math.max(w[idx] || 0, val.length, key.length);
      });
      return w;
    }, []);
    worksheet['!cols'] = max_len.map((len: number) => ({ wch: len + 3 }));

    XLSX.writeFile(workbook, 'consolidado_notas_fiscais.xlsx')
  }

  const handleClear = () => {
    setResults([])
    setExpandedIndex(null)
  }

  const successCount = results.filter(r => r.xmlContent).length
  const processingCount = results.filter(r => r.isProcessing).length
  const errorCount = results.filter(r => r.error).length

  const progressPercent = results.length > 0 ? Math.round(((successCount + errorCount) / results.length) * 100) : 0

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-indigo-500 animate-pulse" />
            <CardTitle>Importar PDFs de Notas Fiscais (DANFE)</CardTitle>
          </div>
          <CardDescription>
            Arraste arquivos ou pastas, ou clique nas opções abaixo. Nosso sistema processará os arquivos em lote (3 em paralelo) e extrairá todos os dados estruturados de volta ao formato XML de NF-e legítimo no padrão da Sefaz.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Selector de Método de Conversão */}
          <div className="p-3.5 bg-zinc-100 border border-zinc-200 rounded-lg dark:bg-zinc-900/50 dark:border-zinc-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
            <div>
              <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-200 flex items-center gap-1.5">
                Método de Conversão
              </p>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                Conversão realizada localmente com parser de texto do PDF, sem uso de IA.
              </p>
            </div>
          </div>

          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 text-center transition-all ${
              isDragOver
                ? 'border-indigo-500 bg-indigo-50/10 dark:border-indigo-400'
                : 'border-zinc-300 hover:border-indigo-400 dark:border-zinc-800'
            }`}
          >
            <div className="rounded-full bg-indigo-50 p-4 text-indigo-500 dark:bg-indigo-950/40 mb-4">
              <Upload className="h-8 w-8 animate-bounce" />
            </div>
            
            <p className="font-semibold text-zinc-700 dark:text-zinc-300 text-base">
              Arraste e solte arquivos PDF ou pastas de arquivos aqui
            </p>
            <p className="text-xs text-zinc-400 mt-1 mb-6">
              O sistema identificará de forma inteligente e extrairá todos os arquivos de extensão .PDF
            </p>
            <p className="text-xs font-medium text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30 px-3 py-1 rounded-full mb-6 max-w-md mx-auto">
              Modo local ativo: as notas serão convertidas localmente pelo parser de texto do PDF.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 w-full max-w-md">
              <div className="w-full">
                <input
                  type="file"
                  id="pdf-upload"
                  ref={fileInputRef}
                  multiple
                  accept=".pdf"
                  className="hidden"
                  onChange={handleFileChange}
                />
                <Button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  variant="outline"
                  className="w-full cursor-pointer border-indigo-200 hover:bg-slate-50 dark:border-indigo-900/40 text-sm py-2"
                >
                  <FileText className="mr-2 h-4 w-4 text-indigo-500" />
                  Selecionar Arquivos .PDF
                </Button>
              </div>

              <div className="w-full">
                <input
                  type="file"
                  id="pdf-folder-upload"
                  ref={folderInputRef}
                  className="hidden"
                  onChange={handleFileChange}
                  {...{ webkitdirectory: "", directory: "", multiple: true }}
                />
                <Button
                  type="button"
                  onClick={() => folderInputRef.current?.click()}
                  variant="outline"
                  className="w-full cursor-pointer border-indigo-200 hover:bg-slate-50 dark:border-indigo-900/40 text-sm py-2"
                >
                  <Upload className="mr-2 h-4 w-4 text-indigo-500" />
                  Selecionar Pasta Inteira
                </Button>
              </div>
            </div>
          </div>

          {results.length > 0 && (
            <div className="p-4 rounded-lg bg-zinc-50 border border-zinc-100 dark:bg-zinc-900/50 dark:border-zinc-800 space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
                  Progresso geral do lote ({successCount + errorCount} de {results.length} concluídos)
                </h4>
                <span className="text-xs font-bold text-indigo-500 bg-indigo-50 dark:bg-indigo-950/50 px-2 py-0.5 rounded-full">
                  {progressPercent}%
                </span>
              </div>
              <div className="w-full bg-zinc-200 dark:bg-zinc-800 h-2.5 rounded-full overflow-hidden">
                <div
                  className="bg-indigo-600 dark:bg-indigo-500 h-full transition-all duration-300 rounded-full"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>

              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pt-1">
                <div className="flex flex-wrap items-center gap-4 text-xs">
                  {successCount > 0 && (
                    <span className="flex items-center gap-1.5 text-green-600 font-medium">
                      <CheckCircle2 className="h-4 w-4" />
                      {successCount} convertido{successCount > 1 ? 's' : ''}
                    </span>
                  )}
                  {processingCount > 0 && (
                    <span className="flex items-center gap-1.5 text-indigo-500 animate-pulse font-medium">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      {processingCount} processando...
                    </span>
                  )}
                  {errorCount > 0 && (
                    <span className="flex items-center gap-1.5 text-destructive font-medium">
                      <AlertCircle className="h-4 w-4" />
                      {errorCount} erro{errorCount > 1 ? 's' : ''}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2 self-end sm:self-auto">
                  {successCount > 0 && (
                    <>
                      <Button onClick={handleDownloadAllExcel} size="sm" variant="outline" className="gap-2 border-green-200 dark:border-green-900/40 text-green-600 hover:bg-green-50/55 dark:hover:bg-green-950/20 font-medium cursor-pointer">
                        <FileSpreadsheet className="h-4 w-4 text-green-500" />
                        Baixar Excel (.xlsx)
                      </Button>
                      <Button onClick={handleDownloadAllZIP} size="sm" className="gap-2 bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600 border-none text-white font-medium cursor-pointer">
                        <Download className="h-4 w-4" />
                        Baixar Todos (.ZIP)
                      </Button>
                    </>
                  )}
                  <Button onClick={handleClear} variant="outline" size="sm" title="Limpar lista" className="cursor-pointer">
                    Limpar
                  </Button>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
      
      {/* Exibição dos resultados */}
      {results.length > 0 && (
        <Card className="border border-zinc-100 dark:border-zinc-800">
          <CardHeader className="pb-3 border-b border-zinc-50 dark:border-zinc-900">
            <CardTitle className="text-lg">Resultados da Conversão</CardTitle>
          </CardHeader>
          <CardContent className="p-0 divide-y divide-zinc-100 dark:divide-zinc-800">
            {results.map((result, idx) => (
              <div key={idx} className="p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  {result.isProcessing ? (
                    <div className="rounded-full bg-indigo-100 p-2 text-indigo-600 dark:bg-indigo-950/40 animate-pulse">
                      <Loader2 className="h-5 w-5 animate-spin" />
                    </div>
                  ) : result.error ? (
                    <div className="rounded-full bg-red-100 p-2 text-red-600 dark:bg-red-950/40">
                      <AlertCircle className="h-5 w-5" />
                    </div>
                  ) : (
                    <div className="rounded-full bg-green-100 p-2 text-green-600 dark:bg-green-950/40">
                      <CheckCircle2 className="h-5 w-5" />
                    </div>
                  )}
                  <div>
                    <p className="font-medium text-sm text-zinc-900 dark:text-zinc-100">{result.fileName}</p>
                    {result.isProcessing ? (
                      <p className="text-xs text-indigo-500 mt-0.5">Convertendo PDF localmente...</p>
                    ) : result.error ? (
                      <p className="text-xs text-destructive mt-0.5">{result.error}</p>
                    ) : (
                      <p className="text-xs text-zinc-400 mt-0.5">XML gerado com sucesso!</p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 w-full md:w-auto justify-end">
                  {result.xmlContent && (
                    <>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleDownloadSingleXML(result)}
                        className="gap-1.5"
                      >
                        <FileCode className="h-4 w-4 text-zinc-500" />
                        Baixar XML
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => {
                          if (result.xmlContent) {
                            onAnalyzeXML(result.fileName.replace(/\.pdf$/i, '.xml'), result.xmlContent)
                          }
                        }}
                        className="gap-1.5 bg-green-600 hover:bg-green-700 dark:bg-green-500 dark:hover:bg-green-600 text-white"
                      >
                        Analisar Nota
                        <ArrowRight className="h-4 w-4" />
                      </Button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
