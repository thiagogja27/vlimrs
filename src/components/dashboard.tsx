"use client"

import { useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { type NFEData } from "@/lib/nfe-parser"

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts"
import { Building2, Truck, Package, MapPin } from "lucide-react"

interface DashboardProps {
  files: Array<{
    nfeData: NFEData | null
  }>
}

const COLORS = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042", "#8884d8", "#82ca9d"]

export function Dashboard({ files }: DashboardProps) {
  const stats = useMemo(() => {
    const validFiles = files.filter((f) => f.nfeData !== null)

    // Contagem por Destinatário/Remetente
    const destinatarioCount: Record<string, number> = {}
    // Contagem por Terminal de Entrega
    const terminalCount: Record<string, number> = {}
    // Contagem por Produto
    const produtoCount: Record<string, number> = {}
    // Contagem por Transbordo
    const transbordoCount: Record<string, number> = {}

    validFiles.forEach((f) => {
      const nfe = f.nfeData!

      // Destinatário
      const dest = nfe.destinatario.nome || "Nao Informado"
      destinatarioCount[dest] = (destinatarioCount[dest] || 0) + 1

      // Terminal de Entrega
      const terminal = nfe.terminalEntrega || "Nao Informado"
      terminalCount[terminal] = (terminalCount[terminal] || 0) + 1

      // Produto
      const produto = nfe.tipoProduto === "OUTRO" ? "Outros" : nfe.tipoProduto
      produtoCount[produto] = (produtoCount[produto] || 0) + 1

      // Transbordo
      const transbordo = nfe.transbordo || "Nao Informado"
      transbordoCount[transbordo] = (transbordoCount[transbordo] || 0) + 1
    })

    const toChartData = (obj: Record<string, number>) =>
      Object.entries(obj)
        .map(([name, value]) => ({ name: name.substring(0, 25), fullName: name, value }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 10)

    return {
      totalNotas: validFiles.length,
      destinatarios: toChartData(destinatarioCount),
      terminais: toChartData(terminalCount),
      produtos: toChartData(produtoCount),
      transbordos: toChartData(transbordoCount),
    }
  }, [files])

  if (files.filter((f) => f.nfeData !== null).length === 0) {
    return null
  }

  return (
    <div className="space-y-6">

      {/* Cards de resumo */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Notas</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalNotas}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Destinatarios</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.destinatarios.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Terminais</CardTitle>
            <MapPin className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.terminais.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Transbordos</CardTitle>
            <Truck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.transbordos.length}</div>
          </CardContent>
        </Card>
      </div>

      {/* Graficos */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Grafico de Produtos */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Notas por Produto</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={stats.produtos}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {stats.produtos.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Grafico de Destinatarios */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Notas por Destinatario</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.destinatarios} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" />
                  <YAxis dataKey="name" type="category" width={120} tick={{ fontSize: 11 }} />
                  <Tooltip
                    formatter={(value, _, props) => [value, props.payload.fullName]}
                  />
                  <Bar dataKey="value" fill="#0088FE" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Grafico de Terminais de Entrega */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Notas por Terminal de Entrega</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.terminais} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" />
                  <YAxis dataKey="name" type="category" width={120} tick={{ fontSize: 11 }} />
                  <Tooltip
                    formatter={(value, _, props) => [value, props.payload.fullName]}
                  />
                  <Bar dataKey="value" fill="#00C49F" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Grafico de Transbordos */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Notas por Transbordo</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.transbordos} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" />
                  <YAxis dataKey="name" type="category" width={120} tick={{ fontSize: 11 }} />
                  <Tooltip
                    formatter={(value, _, props) => [value, props.payload.fullName]}
                  />
                  <Bar dataKey="value" fill="#FFBB28" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
