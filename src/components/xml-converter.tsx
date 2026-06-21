'use client'

import React, { useState, useCallback } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { parseNFE, type NFEData } from '@/lib/nfe-parser'
import { Dashboard } from '@/components/dashboard'
import { SearchPanel } from '@/components/search-panel'
import { MapPanel } from '@/components/map-panel' // Importar o novo painel do mapa
import { PDFToXMLConverter } from '@/components/pdf-to-xml-converter'
import {
  FileText,
  Upload,
  Download,
  AlertCircle,
  CheckCircle2,
  X,
  FileArchive,
  Loader2,
  ChevronDown,
  ChevronUp,
  BarChart3,
  Search,
  List,
  MapPin,
  Truck,
  Package,
  FileSpreadsheet,
  Map, // Ícone para a aba do mapa
  Sparkles,
  FileCode,
} from 'lucide-react'
import JSZip from 'jszip'
import * as XLSX from 'xlsx'

interface ProcessedFile {
  fileName: string
  originalPath: string
  xmlContent: string
  nfeData: NFEData | null
  error: string | null
}

export function XMLConverter() {
  const [files, setFiles] = useState<ProcessedFile[]>([])
  const [otherZipFiles, setOtherZipFiles] = useState<{ path: string; content: Blob }[]>([])
  const [isDragOver, setIsDragOver] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null)
  const [activeTab, setActiveTab] = useState<string>('list')
  const [converterMode, setConverterMode] = useState<'xml-to-pdf' | 'pdf-to-xml'>('xml-to-pdf')

  const processXMLContent = async (
    fileName: string,
    originalPath: string,
    content: string
  ): Promise<ProcessedFile> => {
    try {
      const data = parseNFE(content)
      return { fileName, originalPath, xmlContent: content, nfeData: data, error: null }
    } catch (err) {
      console.error(`Erro ao processar ${fileName}:`, err)
      return { fileName, originalPath, xmlContent: content, nfeData: null, error: 'Erro ao processar arquivo XML' }
    }
  }

  const handleAnalyzeGeneratedXML = async (fileName: string, xmlContent: string) => {
    setIsProcessing(true)
    const result = await processXMLContent(fileName, fileName, xmlContent)
    setFiles([result])
    setIsProcessing(false)
    setConverterMode('xml-to-pdf')
    setActiveTab('list')
    setExpandedIndex(0)

    if (result.nfeData) {
      const hasTeg = result.nfeData.terminalEntrega?.toUpperCase()?.includes('TEG')
      const hasTeag = result.nfeData.terminalEntrega?.toUpperCase()?.includes('TEAG')

      if (hasTeg && hasTeag) {
        alert('Foram encontradas notas com os terminais TEG e TEAG.')
      } else if (hasTeg) {
        alert('Foram encontradas notas com o terminal TEG.')
      } else if (hasTeag) {
        alert('Foram encontradas notas com o terminal TEAG.')
      } else {
        alert('Nenhuma nota com terminal de entrega TEG ou TEAG foi encontrada.')
      }
    }
  }

  interface ZipFileData {
    files: ProcessedFile[]
    otherFiles: { path: string; content: Blob }[]
  }

  const processZipFile = async (zipFile: File): Promise<ZipFileData> => {
    const zip = new JSZip()
    const contents = await zip.loadAsync(zipFile)
    const results: ProcessedFile[] = []
    const otherFiles: { path: string; content: Blob }[] = []

    const allFiles = Object.keys(contents.files).filter(
      (name) => !contents.files[name].dir
    )

    for (const filePath of allFiles) {
      const fileName = filePath.split('/').pop() || filePath
      
      if (filePath.toLowerCase().endsWith('.xml')) {
        const fileContent = await contents.files[filePath].async('string')
        const result = await processXMLContent(fileName, filePath, fileContent)
        results.push(result)
      } else {
        const content = await contents.files[filePath].async('blob')
        otherFiles.push({ path: filePath, content })
      }
    }
    return { files: results, otherFiles }
  }

  const processFiles = useCallback(async (selectedFiles: FileList) => {
    setIsProcessing(true)
    setFiles([])
    setOtherZipFiles([])
    setExpandedIndex(null)

    const results: ProcessedFile[] = []
    const allOtherFiles: { path: string; content: Blob }[] = []

    for (const file of Array.from(selectedFiles)) {
      const fileName = file.name.toLowerCase()

      if (fileName.endsWith('.zip')) {
        try {
          const zipData = await processZipFile(file)
          results.push(...zipData.files)
          allOtherFiles.push(...zipData.otherFiles)
        } catch (err) {
          console.error(`[v0] Erro ao processar o arquivo ZIP '${file.name}':`, err);
          results.push({
            fileName: file.name,
            originalPath: file.name,
            xmlContent: '',
            nfeData: null,
            error: 'Erro ao extrair arquivo ZIP. Verifique o console.',
          })
        }
      } else if (fileName.endsWith('.xml')) {
        const content = await file.text()
        const result = await processXMLContent(file.name, file.name, content)
        results.push(result)
      } else {
        results.push({
          fileName: file.name,
          originalPath: file.name,
          xmlContent: '',
          nfeData: null,
          error: 'Formato nao suportado. Use XML ou ZIP.',
        })
      }
    }

    setFiles(results)
    setOtherZipFiles(allOtherFiles)
    setIsProcessing(false)

    if (results.some(r => r.nfeData)) {
      const hasTeg = results.some(r => r.nfeData?.terminalEntrega?.toUpperCase().includes('TEG'));
      const hasTeag = results.some(r => r.nfeData?.terminalEntrega?.toUpperCase().includes('TEAG'));

      if (hasTeg && hasTeag) {
          alert('Foram encontradas notas com os terminais TEG e TEAG.');
      } else if (hasTeg) {
          alert('Foram encontradas notas com o terminal TEG.');
      } else if (hasTeag) {
          alert('Foram encontradas notas com o terminal TEAG.');
      } else {
          alert('Nenhuma nota com terminal de entrega TEG ou TEAG foi encontrada.');
      }
  }

    if (results.length === 1 && results[0].nfeData) {
      setExpandedIndex(0)
    }
  }, [])

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files
    if (selectedFiles && selectedFiles.length > 0) {
      processFiles(selectedFiles)
    }
  }

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setIsDragOver(false)
      const droppedFiles = e.dataTransfer.files
      if (droppedFiles.length > 0) {
        processFiles(droppedFiles)
      }
    },
    [processFiles]
  )

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
  }, [])

  const handleDownloadPDF = async (processedFile: ProcessedFile) => {
    if (!processedFile.nfeData) return;

    const { generatePDF } = await import('@/lib/pdf-generator');
    const doc = generatePDF(processedFile.nfeData);
    const baseName = processedFile.fileName.replace(/\.xml$/i, '');
    const fileName = `NF_${processedFile.nfeData.numero || baseName}_${Date.now()}.pdf`;
    doc.save(fileName);
  }

  const [isDownloading, setIsDownloading] = useState(false)

  const handleDownloadAllPDFs = async () => {
    const successfulFiles = files.filter((f) => f.nfeData !== null);
    if (successfulFiles.length === 0) return;

    if (successfulFiles.length === 1 && otherZipFiles.length === 0) {
      handleDownloadPDF(successfulFiles[0]);
      return;
    }

    setIsDownloading(true);

    try {
      const { generatePDF } = await import('@/lib/pdf-generator');
      const zip = new JSZip();

      for (const file of files) {
        const normalizedPath = file.originalPath.replace(/\\/g, "/");
        const lastSlashIndex = normalizedPath.lastIndexOf('/');
        const folderPath = lastSlashIndex > -1 ? normalizedPath.substring(0, lastSlashIndex + 1) : '';

        if (file.xmlContent) {
          zip.file(normalizedPath, file.xmlContent);
        }

        if (file.nfeData) {
          try {
            const doc = generatePDF(file.nfeData);
            const pdfBlob = doc.output("blob");
            const baseName = file.fileName.replace(/\.xml$/i, '');
            const pdfFileName = `${file.nfeData.numero || baseName}.pdf`;
            const fullPdfPath = `${folderPath}${pdfFileName}`;
            zip.file(fullPdfPath, pdfBlob);
          } catch (pdfErr) {
            console.error(`[v0] Erro ao gerar PDF para: ${file.fileName}`, pdfErr);
          }
        }
      }

      for (const otherFile of otherZipFiles) {
        const normalizedPath = otherFile.path.replace(/\\/g, "/");
        zip.file(normalizedPath, otherFile.content);
      }

      const zipBlob = await zip.generateAsync({ type: 'blob' });
      
      const url = URL.createObjectURL(zipBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `notas_fiscais_convertidas_${Date.now()}.zip`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('[v0] Erro ao gerar ZIP:', err);
      alert('Erro ao gerar o arquivo ZIP. Verifique o console para mais detalhes.');
    } finally {
      setIsDownloading(false);
    }
  };

  const handleDownloadExcel = () => {
    const successfulFiles = files.filter((f) => f.nfeData !== null);
    if (successfulFiles.length === 0) return;

    const dataToExport = [];
    const headers = [
      "Arquivo", "Chave de Acesso", "Numero NFe", "Data Emissão",
      "Emitente Nome", "Emitente CNPJ", "Destinatário Nome", "Destinatário CNPJ",
      "Valor Total", "Terminal de Entrega", "Transbordo", "Retirada", "Tipo Produto"
    ];

    for (const file of successfulFiles) {
        if (file.nfeData) {
            dataToExport.push([
                file.fileName,
                file.nfeData.chaveAcesso,
                file.nfeData.numero,
                file.nfeData.dataEmissao,
                file.nfeData.emitente.nome,
                file.nfeData.emitente.cnpj,
                file.nfeData.destinatario.nome,
                file.nfeData.destinatario.cpfCnpj,
                file.nfeData.impostos.valorTotal,
                file.nfeData.terminalEntrega,
                file.nfeData.transbordo,
                file.nfeData.retirada,
                file.nfeData.tipoProduto
            ]);
        }
    }

    const worksheet = XLSX.utils.aoa_to_sheet([headers, ...dataToExport]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Notas Fiscais");

    const itemsDataToExport: any[][] = [];
    const itemHeaders = ["Chave de Acesso", "Numero NFe", "Código Produto", "Descrição", "NCM", "CFOP", "Quantidade", "Unidade", "Valor Unitário", "Valor Total"];

    for (const file of successfulFiles) {
        if (file.nfeData && file.nfeData.itens) {
            file.nfeData.itens.forEach(item => {
                itemsDataToExport.push([
                    file.nfeData!.chaveAcesso,
                    file.nfeData!.numero,
                    item.codigo,
                    item.descricao,
                    item.ncm,
                    item.cfop,
                    item.quantidade,
                    item.unidade,
                    item.valorUnitario,
                    item.valorTotal
                ]);
            });
        }
    }

    if(itemsDataToExport.length > 0) {
        const itemsWorksheet = XLSX.utils.aoa_to_sheet([itemHeaders, ...itemsDataToExport]);
        XLSX.utils.book_append_sheet(workbook, itemsWorksheet, "Itens das Notas");
    }

    XLSX.writeFile(workbook, `relatorio_nfe_${Date.now()}.xlsx`);
  };

  const handleClear = () => {
    setFiles([])
    setOtherZipFiles([])
    setExpandedIndex(null)
  }

  const formatCurrency = (value: number) => {
    return value.toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    })
  }

  const successCount = files.filter((f) => f.nfeData !== null).length
  const errorCount = files.filter((f) => f.error !== null).length

  return (
    <div className='min-h-screen bg-background p-4 md:p-8'>
      <div className='mx-auto max-w-4xl'>
        <div className='mb-8 text-center'>
          <div className='mb-4 inline-flex items-center justify-center rounded-full bg-primary/10 p-3'>
            <FileText className='h-8 w-8 text-primary' />
          </div>
          <h1 className='text-3xl font-bold tracking-tight text-foreground'>
            Conversor de Notas Fiscais
          </h1>
          <p className='mt-2 text-muted-foreground'>
            Converta, analise e extraia dados de suas notas fiscais de forma inteligente
          </p>
        </div>

        {/* Mode Selector */}
        <div className="mb-8 flex justify-center">
          <div className="inline-flex rounded-lg bg-zinc-100 p-1 dark:bg-zinc-800">
            <button
              onClick={() => setConverterMode('xml-to-pdf')}
              className={`flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-all ${
                converterMode === 'xml-to-pdf'
                  ? 'bg-white text-zinc-900 shadow-sm dark:bg-zinc-900 dark:text-zinc-50'
                  : 'text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50'
              }`}
            >
              <FileCode className="h-4 w-4" />
              XML para PDF / Painel
            </button>
            <button
              onClick={() => setConverterMode('pdf-to-xml')}
              className={`flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-all ${
                converterMode === 'pdf-to-xml'
                  ? 'bg-white text-zinc-900 shadow-sm dark:bg-zinc-900 dark:text-zinc-50'
                  : 'text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50'
              }`}
            >
              <Sparkles className="h-4 w-4 text-indigo-500" />
              PDF para XML (IA Gemini)
            </button>
          </div>
        </div>

        {converterMode === 'pdf-to-xml' ? (
          <PDFToXMLConverter onAnalyzeXML={handleAnalyzeGeneratedXML} />
        ) : (
          <>
            {/* Upload Area */}
            <Card className='mb-6'>
          <CardHeader>
            <CardTitle className='text-lg'>Upload de Arquivos</CardTitle>
            <CardDescription>
              Arraste arquivos XML ou um arquivo ZIP contendo multiplos XMLs
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              className={`relative flex min-h-[200px] cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed transition-colors ${
                isDragOver
                  ? 'border-primary bg-primary/5'
                  : 'border-muted-foreground/25 hover:border-primary/50'
              }`}
            >
              <input
                type='file'
                accept='.xml,.zip'
                multiple
                onChange={handleFileChange}
                className='absolute inset-0 cursor-pointer opacity-0'
              />
              {isProcessing ? (
                <>
                  <Loader2 className='mb-4 h-12 w-12 animate-spin text-primary' />
                  <p className='text-sm font-medium text-foreground'>Processando arquivos...</p>
                </>
              ) : (
                <>
                  <div className='mb-4 flex items-center gap-3'>
                    <Upload
                      className={`h-10 w-10 ${isDragOver ? 'text-primary' : 'text-muted-foreground'}`}
                    />
                    <FileArchive
                      className={`h-10 w-10 ${isDragOver ? 'text-primary' : 'text-muted-foreground'}`}
                    />
                  </div>
                  <p className='mb-1 text-sm font-medium text-foreground'>
                    {isDragOver ? 'Solte os arquivos aqui' : 'Arraste arquivos XML ou ZIP aqui'}
                  </p>
                  <p className='text-xs text-muted-foreground'>
                    ou clique para selecionar (suporta multiplos arquivos)
                  </p>
                </>
              )}
            </div>

            {files.length > 0 && (
              <div className='mt-4 flex items-center justify-between'>
                <div className='flex items-center gap-4 text-sm'>
                  {successCount > 0 && (
                    <span className='flex items-center gap-1 text-green-600'>
                      <CheckCircle2 className='h-4 w-4' />
                      {successCount} processado{successCount > 1 ? 's' : ''}
                    </span>
                  )}
                  {errorCount > 0 && (
                    <span className='flex items-center gap-1 text-destructive'>
                      <AlertCircle className='h-4 w-4' />
                      {errorCount} erro{errorCount > 1 ? 's' : ''}
                    </span>
                  )}
                </div>
                <div className='flex items-center gap-2'>
                {successCount > 0 && (
                    <>
                        <Button onClick={handleDownloadExcel} size='sm' className='gap-2'>
                            <FileSpreadsheet className='h-4 w-4' />
                            Excel
                        </Button>
                        <Button onClick={handleDownloadAllPDFs} size='sm' className='gap-2' disabled={isDownloading}>
                        {isDownloading ? (
                            <>
                            <Loader2 className='h-4 w-4 animate-spin' />
                            Gerando...
                            </>
                        ) : (
                            <>
                            <Download className='h-4 w-4' />
                            {successCount > 1 ? `PDFs (${successCount})` : 'PDF'}
                            </>
                        )}
                        </Button>
                    </>
                  )}
                  <Button onClick={handleClear} variant='outline' size='sm'>
                    <X className='h-4 w-4' />
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Results Area */}
        {files.length > 0 && (
          <Tabs value={activeTab} onValueChange={setActiveTab} className='w-full'>
            <TabsList className='mb-4 grid w-full grid-cols-4'>
              <TabsTrigger value='list' className='gap-2'>
                <List className='h-4 w-4' />
                Lista
              </TabsTrigger>
              <TabsTrigger value='dashboard' className='gap-2'>
                <BarChart3 className='h-4 w-4' />
                Dashboard
              </TabsTrigger>
              <TabsTrigger value='search' className='gap-2'>
                <Search className='h-4 w-4' />
                Pesquisa
              </TabsTrigger>
               <TabsTrigger value='map' className='gap-2'>
                <Map className='h-4 w-4' />
                Mapa
              </TabsTrigger>
            </TabsList>

            <TabsContent value='list' className='space-y-4'>
          {files.map((processedFile, index) => (
              <Card
                key={index}
                className={processedFile.error ? 'border-destructive/50' : ''}
              >
                <CardHeader
                  className='cursor-pointer'
                  onClick={() =>
                    processedFile.nfeData &&
                    setExpandedIndex(expandedIndex === index ? null : index)
                  }
                >
                  <div className='flex items-center justify-between'>
                    <div className='flex items-center gap-3'>
                      {processedFile.error ? (
                        <AlertCircle className='h-5 w-5 flex-shrink-0 text-destructive' />
                      ) : (
                        <CheckCircle2 className='h-5 w-5 flex-shrink-0 text-green-600' />
                      )}
                      <div>
                        <CardTitle className='text-base'>
                          {processedFile.fileName}
                        </CardTitle>
                        {processedFile.error ? (
                          <CardDescription className='text-destructive'>
                            {processedFile.error}
                          </CardDescription>
                        ) : processedFile.nfeData ? (
                          <CardDescription>
                            {processedFile.nfeData.tipo === 'NFe' ? 'NF-e' : 'Nota Fiscal'}{" "}
                            - Numero: {processedFile.nfeData.numero || 'N/A'} -{" "}
                            {formatCurrency(processedFile.nfeData.impostos.valorTotal)}
                          </CardDescription>
                        ) : null}
                      </div>
                    </div>
                    <div className='flex items-center gap-2'>
                      {processedFile.nfeData && (
                        <>
                          <Button
                            onClick={(e) => {
                              e.stopPropagation()
                              handleDownloadPDF(processedFile)
                            }}
                            size='sm'
                            variant='outline'
                            className='gap-2'
                          >
                            <Download className='h-4 w-4' />
                            PDF
                          </Button>
                          {expandedIndex === index ? (
                            <ChevronUp className='h-5 w-5 text-muted-foreground' />
                          ) : (
                            <ChevronDown className='h-5 w-5 text-muted-foreground' />
                          )}
                        </>
                      )}
                    </div>
                  </div>
                </CardHeader>

                {expandedIndex === index && processedFile.nfeData && (
                  <CardContent className='space-y-6 border-t pt-6'>
                    {/* Info Geral */}
                    <div className='grid gap-4 rounded-lg bg-muted/50 p-4 sm:grid-cols-2 lg:grid-cols-4'>
                      <div>
                        <p className='text-xs font-medium uppercase text-muted-foreground'>
                          Numero
                        </p>
                        <p className='text-lg font-semibold'>
                          {processedFile.nfeData.numero || 'N/A'}
                        </p>
                      </div>
                      <div>
                        <p className='text-xs font-medium uppercase text-muted-foreground'>
                          Serie
                        </p>
                        <p className='text-lg font-semibold'>
                          {processedFile.nfeData.serie || 'N/A'}
                        </p>
                      </div>
                      <div>
                        <p className='text-xs font-medium uppercase text-muted-foreground'>
                          Data Emissao
                        </p>
                        <p className='text-lg font-semibold'>
                          {processedFile.nfeData.dataEmissao || 'N/A'}
                        </p>
                      </div>
                      <div>
                        <p className='text-xs font-medium uppercase text-muted-foreground'>
                          Valor Total
                        </p>
                        <p className='text-lg font-semibold text-primary'>
                          {formatCurrency(processedFile.nfeData.impostos.valorTotal)}
                        </p>
                      </div>
                    </div>

                    {/* Informações Logísticas */}
                    {(processedFile.nfeData.terminalEntrega || processedFile.nfeData.transbordo || processedFile.nfeData.retirada || processedFile.nfeData.tipoProduto !== 'OUTRO') && (
                      <div className='grid gap-4 rounded-lg border border-blue-200 bg-blue-50/50 p-4 dark:border-blue-900 dark:bg-blue-950/20 sm:grid-cols-2 lg:grid-cols-4'>
                        <div className='flex items-start gap-2'>
                          <Package className='mt-0.5 h-4 w-4 text-blue-600' />
                          <div>
                            <p className='text-xs font-medium uppercase text-muted-foreground'>
                              Produto
                            </p>
                            <p className='font-semibold'>
                              {processedFile.nfeData.tipoProduto === 'OUTRO' ? 'Outro' : processedFile.nfeData.tipoProduto}
                            </p>
                          </div>
                        </div>
                        {processedFile.nfeData.terminalEntrega && (
                          <div className='flex items-start gap-2'>
                            <MapPin className='mt-0.5 h-4 w-4 text-green-600' />
                            <div>
                              <p className='text-xs font-medium uppercase text-muted-foreground'>
                                Terminal Entrega
                              </p>
                              <p className='font-semibold text-sm'>
                                {processedFile.nfeData.terminalEntrega}
                              </p>
                            </div>
                          </div>
                        )}
                        {processedFile.nfeData.transbordo && (
                          <div className='flex items-start gap-2'>
                            <Truck className='mt-0.5 h-4 w-4 text-orange-600' />
                            <div>
                              <p className='text-xs font-medium uppercase text-muted-foreground'>
                                Transbordo
                              </p>
                              <p className='font-semibold text-sm'>
                                {processedFile.nfeData.transbordo}
                              </p>
                            </div>
                          </div>
                        )}
                        {processedFile.nfeData.retirada && (
                          <div className='flex items-start gap-2'>
                            <FileArchive className='mt-0.5 h-4 w-4 text-purple-600' />
                            <div>
                              <p className='text-xs font-medium uppercase text-muted-foreground'>
                                Retirada
                              </p>
                              <p className='font-semibold text-sm'>
                                {processedFile.nfeData.retirada}
                              </p>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Emitente e Destinatario */}
                    <div className='grid gap-6 md:grid-cols-2'>
                      <div className='rounded-lg border p-4'>
                        <h3 className='mb-3 font-semibold text-foreground'>Emitente</h3>
                        <div className='space-y-1 text-sm'>
                          <p className='font-medium'>
                            {processedFile.nfeData.emitente.nome || 'N/A'}
                          </p>
                          {processedFile.nfeData.emitente.nomeFantasia && (
                            <p className='text-muted-foreground'>
                              {processedFile.nfeData.emitente.nomeFantasia}
                            </p>
                          )}
                          <p className='text-muted-foreground'>
                            CNPJ: {processedFile.nfeData.emitente.cnpj || 'N/A'}
                          </p>
                          {processedFile.nfeData.emitente.endereco && (
                            <p className='text-muted-foreground'>
                              {processedFile.nfeData.emitente.endereco}
                            </p>
                          )}
                          {(processedFile.nfeData.emitente.cidade ||
                            processedFile.nfeData.emitente.uf) && (
                            <p className='text-muted-foreground'>
                              {processedFile.nfeData.emitente.cidade} -{" "}
                              {processedFile.nfeData.emitente.uf}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className='rounded-lg border p-4'>
                        <h3 className='mb-3 font-semibold text-foreground'>Destinatario</h3>
                        <div className='space-y-1 text-sm'>
                          <p className='font-medium'>
                            {processedFile.nfeData.destinatario.nome || 'N/A'}
                          </p>
                          <p className='text-muted-foreground'>
                            CPF/CNPJ: {processedFile.nfeData.destinatario.cpfCnpj || 'N/A'}
                          </p>
                          {processedFile.nfeData.destinatario.endereco && (
                            <p className='text-muted-foreground'>
                              {processedFile.nfeData.destinatario.endereco}
                            </p>
                          )}
                          {(processedFile.nfeData.destinatario.cidade ||
                            processedFile.nfeData.destinatario.uf) && (
                            <p className='text-muted-foreground'>
                              {processedFile.nfeData.destinatario.cidade} -{" "}
                              {processedFile.nfeData.destinatario.uf}
                            </p>
                          )}
                          {processedFile.nfeData.destinatario.email && (
                            <p className='text-muted-foreground'>
                              {processedFile.nfeData.destinatario.email}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Itens */}
                    {processedFile.nfeData.itens.length > 0 && (
                      <div>
                        <h3 className='mb-3 font-semibold text-foreground'>
                          Produtos / Servicos
                        </h3>
                        <div className='overflow-x-auto rounded-lg border'>
                          <table className='w-full text-sm'>
                            <thead className='bg-muted'>
                              <tr>
                                <th className='px-4 py-3 text-left font-medium'>Descricao</th>
                                <th className='px-4 py-3 text-center font-medium'>Qtd</th>
                                <th className='px-4 py-3 text-right font-medium'>V. Unit</th>
                                <th className='px-4 py-3 text-right font-medium'>V. Total</th>
                              </tr>
                            </thead>
                            <tbody className='divide-y'>
                              {processedFile.nfeData.itens.map((item, itemIndex) => (
                                <tr key={itemIndex} className='hover:bg-muted/50'>
                                  <td className='px-4 py-3'>
                                    <p className='font-medium'>{item.descricao}</p>
                                    {item.ncm && (
                                      <p className='text-xs text-muted-foreground'>
                                        NCM: {item.ncm}
                                      </p>
                                    )}
                                  </td>
                                  <td className='px-4 py-3 text-center'>
                                    {item.quantidade.toFixed(2)} {item.unidade}
                                  </td>
                                  <td className='px-4 py-3 text-right'>
                                    {formatCurrency(item.valorUnitario)}
                                  </td>
                                  <td className='px-4 py-3 text-right font-medium'>
                                    {formatCurrency(item.valorTotal)}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    {/* Totais */}
                    <div className='rounded-lg border p-4'>
                      <h3 className='mb-3 font-semibold text-foreground'>Resumo dos Valores</h3>
                      <div className='grid gap-4 sm:grid-cols-2 lg:grid-cols-3'>
                        <div className='flex justify-between'>
                          <span className='text-muted-foreground'>Produtos/Servicos:</span>
                          <span className='font-medium'>
                            {formatCurrency(processedFile.nfeData.impostos.valorProdutos)}
                          </span>
                        </div>
                        <div className='flex justify-between'>
                          <span className='text-muted-foreground'>Desconto:</span>
                          <span className='font-medium'>
                            {formatCurrency(processedFile.nfeData.impostos.desconto)}
                          </span>
                        </div>
                        <div className='flex justify-between'>
                          <span className='text-muted-foreground'>Frete:</span>
                          <span className='font-medium'>
                            {formatCurrency(processedFile.nfeData.impostos.valorFrete)}
                          </span>
                        </div>
                        <div className='flex justify-between'>
                          <span className='text-muted-foreground'>ICMS:</span>
                          <span className='font-medium'>
                            {formatCurrency(processedFile.nfeData.impostos.valorICMS)}
                          </span>
                        </div>
                        <div className='flex justify-between'>
                          <span className='text-muted-foreground'>IPI:</span>
                          <span className='font-medium'>
                            {formatCurrency(processedFile.nfeData.impostos.valorIPI)}
                          </span>
                        </div>
                        <div className='flex justify-between'>
                          <span className='text-muted-foreground'>Outras Desp.:</span>
                          <span className='font-medium'>
                            {formatCurrency(processedFile.nfeData.impostos.outrasDesp)}
                          </span>
                        </div>
                      </div>
                      <div className='mt-4 flex items-center justify-between border-t pt-4'>
                        <span className='text-lg font-semibold'>Valor Total:</span>
                        <span className='text-2xl font-bold text-primary'>
                          {formatCurrency(processedFile.nfeData.impostos.valorTotal)}
                        </span>
                      </div>
                    </div>

                    {/* Chave de Acesso */}
                    {processedFile.nfeData.chaveAcesso && (
                      <div className='rounded-lg bg-muted/50 p-4'>
                        <p className='text-xs font-medium uppercase text-muted-foreground'>
                          Chave de Acesso
                        </p>
                        <p className='mt-1 break-all font-mono text-sm'>
                          {processedFile.nfeData.chaveAcesso}
                        </p>
                      </div>
                    )}
                  </CardContent>
                )}
              </Card>
            ))}
            </TabsContent>

            <TabsContent value='dashboard'>
              <Dashboard files={files} />
            </TabsContent>

            <TabsContent value='search'>
              <SearchPanel 
                files={files} 
                onSelectFile={(index) => {
                  setActiveTab('list')
                  setExpandedIndex(index)
                  // Scroll to the selected card
                  setTimeout(() => {
                    const card = document.querySelector(`[data-file-index="${index}"]`);
                    card?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                  }, 100)
                }}
              />
            </TabsContent>
            
            <TabsContent value='map'>
              <MapPanel files={files} />
            </TabsContent>

          </Tabs>
        )}
          </>
        )}
      </div>
    </div>
  )
}
