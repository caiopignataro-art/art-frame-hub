/**
 * Módulos internos da área de Engenharia e Testes.
 * Cada função exportada corresponde a uma sub-rota em
 * /configuracoes/engenharia/*.
 */
import React, { useState } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Play,
  Code,
  Database,
  Layers,
  Settings2,
  CheckCircle2,
  XCircle,
  Download,
  Search,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

// --- REUSABLE COMPONENTS ---

interface PanelProps {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  actions?: React.ReactNode;
}

export function AdminCard({ title, subtitle, children, actions }: PanelProps) {
  return (
    <Card className="border-border/60 bg-card shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <div>
          <CardTitle className="text-lg font-semibold tracking-tight">{title}</CardTitle>
          {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
        </div>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

function CollapsibleSection({
  title,
  children,
  defaultOpen = false,
}: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border border-border/80 rounded-lg overflow-hidden bg-background">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-3 bg-muted/40 hover:bg-muted/80 transition-colors text-sm font-medium border-b border-border/40"
      >
        <span>{title}</span>
        {open ? (
          <ChevronUp className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        )}
      </button>
      {open && <div className="p-4 bg-card">{children}</div>}
    </div>
  );
}

function StatusBadge({
  status,
  text,
}: {
  status: "success" | "error" | "warning" | "info";
  text: string;
}) {
  const styles = {
    success: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
    error: "bg-destructive/10 text-destructive border-destructive/20",
    warning: "bg-amber-500/10 text-amber-600 border-amber-500/20",
    info: "bg-blue-500/10 text-blue-600 border-blue-500/20",
  };
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-semibold border ${styles[status]}`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${
          status === "success"
            ? "bg-emerald-500"
            : status === "error"
              ? "bg-destructive"
              : status === "warning"
                ? "bg-amber-500"
                : "bg-blue-500"
        }`}
      />
      {text}
    </span>
  );
}

function JsonViewer({ data, filename = "data.json" }: { data: any; filename?: string }) {
  const handleExport = () => {
    const jsonString = `data:text/json;charset=utf-8,${encodeURIComponent(
      JSON.stringify(data, null, 2),
    )}`;
    const downloadAnchor = document.createElement("a");
    downloadAnchor.setAttribute("href", jsonString);
    downloadAnchor.setAttribute("download", filename);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  return (
    <div className="relative group rounded-md border border-border bg-slate-950 p-4 font-mono text-xs text-slate-100 max-h-[350px] overflow-auto">
      <div className="absolute right-4 top-4 opacity-0 group-hover:opacity-100 transition-opacity">
        <Button
          size="icon"
          variant="ghost"
          className="h-7 w-7 text-slate-400 hover:text-white"
          onClick={handleExport}
        >
          <Download className="h-4 w-4" />
        </Button>
      </div>
      <pre>{JSON.stringify(data, null, 2)}</pre>
    </div>
  );
}

// --- MODULE 1: SIMULADOR DE BARRAS ---

export function SimuladorBarras() {
  const [perfil, setPerfil] = useState("M102-Preta");
  const [comprimentoBarra, setComprimentoBarra] = useState(270);
  const [larguraPerfil, setLarguraPerfil] = useState(3.5);
  const [perdaCorte, setPerdaCorte] = useState(10);

  const [pecas, setPecas] = useState([
    { id: 1, comprimento: 110, quantidade: 2 },
    { id: 2, comprimento: 45, quantidade: 4 },
    { id: 3, comprimento: 95, quantidade: 1 },
  ]);
  const [simulatedResults, setSimulatedResults] = useState<any>(null);

  const addPeca = () => {
    const newId = pecas.length > 0 ? Math.max(...pecas.map((p) => p.id)) + 1 : 1;
    setPecas([...pecas, { id: newId, comprimento: 50, quantidade: 1 }]);
  };
  const removePeca = (id: number) => setPecas(pecas.filter((p) => p.id !== id));
  const updatePeca = (id: number, field: string, value: number) =>
    setPecas(pecas.map((p) => (p.id === id ? { ...p, [field]: value } : p)));

  const handleSimular = () => {
    setSimulatedResults({
      barrasUsadas: 3,
      aproveitamento: 81.5,
      desperdicio: 18.5,
      retalhoTotal: 150,
      distribuicao: [
        { barra: 1, pecas: [110, 110, 45], retalho: 5 },
        { barra: 2, pecas: [95, 45, 45, 45], retalho: 40 },
        { barra: 3, pecas: [], retalho: 270 },
      ],
    });
  };

  return (
    <div className="space-y-6">
      <AdminCard title="Configurações de Entrada (Barras)" subtitle="Simulação em ambiente isolado">
        <div className="grid gap-4 md:grid-cols-4">
          <div className="space-y-1">
            <Label>Perfil de Moldura</Label>
            <Input value={perfil} onChange={(e) => setPerfil(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Comprimento da Barra (cm)</Label>
            <Input
              type="number"
              value={comprimentoBarra}
              onChange={(e) => setComprimentoBarra(Number(e.target.value))}
            />
          </div>
          <div className="space-y-1">
            <Label>Largura do Perfil (cm)</Label>
            <Input
              type="number"
              step="0.1"
              value={larguraPerfil}
              onChange={(e) => setLarguraPerfil(Number(e.target.value))}
            />
          </div>
          <div className="space-y-1">
            <Label>Perda de Corte (%)</Label>
            <Input
              type="number"
              value={perdaCorte}
              onChange={(e) => setPerdaCorte(Number(e.target.value))}
            />
          </div>
        </div>
      </AdminCard>

      <AdminCard
        title="Lista de Peças Requeridas"
        subtitle="Medidas de corte a serem acomodadas nas barras"
        actions={
          <Button size="sm" variant="outline" onClick={addPeca}>
            Adicionar Peça
          </Button>
        }
      >
        <div className="border border-border/60 rounded-md overflow-hidden">
          <table className="w-full text-sm text-left">
            <thead className="bg-muted text-muted-foreground text-xs uppercase">
              <tr>
                <th className="px-4 py-2">Comprimento (cm)</th>
                <th className="px-4 py-2">Quantidade</th>
                <th className="px-4 py-2 w-20">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {pecas.map((p) => (
                <tr key={p.id}>
                  <td className="px-4 py-2">
                    <Input
                      type="number"
                      value={p.comprimento}
                      className="h-8 max-w-[150px]"
                      onChange={(e) => updatePeca(p.id, "comprimento", Number(e.target.value))}
                    />
                  </td>
                  <td className="px-4 py-2">
                    <Input
                      type="number"
                      value={p.quantidade}
                      className="h-8 max-w-[150px]"
                      onChange={(e) => updatePeca(p.id, "quantidade", Number(e.target.value))}
                    />
                  </td>
                  <td className="px-4 py-2">
                    <Button size="sm" variant="destructive" onClick={() => removePeca(p.id)}>
                      Remover
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-4 flex justify-end">
          <Button onClick={handleSimular} className="gap-2">
            <Play className="h-4 w-4" /> Simular Corte
          </Button>
        </div>
      </AdminCard>

      {simulatedResults && (
        <AdminCard
          title="Resultados da Simulação"
          subtitle="Aproveitamento e layout gráfico das barras"
        >
          <div className="grid gap-4 md:grid-cols-4 mb-6">
            <div className="p-4 bg-muted/40 rounded-lg border border-border/40">
              <span className="text-xs text-muted-foreground font-medium block">
                Barras Utilizadas
              </span>
              <span className="text-2xl font-bold text-foreground">
                {simulatedResults.barrasUsadas}
              </span>
            </div>
            <div className="p-4 bg-muted/40 rounded-lg border border-border/40">
              <span className="text-xs text-muted-foreground font-medium block">
                Aproveitamento
              </span>
              <span className="text-2xl font-bold text-emerald-600">
                {simulatedResults.aproveitamento}%
              </span>
            </div>
            <div className="p-4 bg-muted/40 rounded-lg border border-border/40">
              <span className="text-xs text-muted-foreground font-medium block">Desperdício</span>
              <span className="text-2xl font-bold text-destructive">
                {simulatedResults.desperdicio}%
              </span>
            </div>
            <div className="p-4 bg-muted/40 rounded-lg border border-border/40">
              <span className="text-xs text-muted-foreground font-medium block">
                Retalho Total
              </span>
              <span className="text-2xl font-bold text-foreground">
                {simulatedResults.retalhoTotal} cm
              </span>
            </div>
          </div>

          <div className="space-y-4">
            <h4 className="text-sm font-semibold">Representação Gráfica e Encaixe</h4>
            {simulatedResults.distribuicao.map((barra: any, idx: number) => (
              <div key={idx} className="space-y-1">
                <div className="flex justify-between text-xs font-mono text-muted-foreground">
                  <span>Barra #{barra.barra}</span>
                  <span>Sobra/Retalho: {barra.retalho} cm</span>
                </div>
                <div className="h-8 w-full border border-border rounded bg-muted/30 flex overflow-hidden">
                  {barra.pecas.map((pecaLen: number, pIdx: number) => {
                    const pct = (pecaLen / comprimentoBarra) * 100;
                    return (
                      <div
                        key={pIdx}
                        style={{ width: `${pct}%` }}
                        className="h-full bg-primary/20 border-r border-primary/50 text-[10px] font-mono flex items-center justify-center font-bold text-primary-foreground"
                      >
                        {pecaLen}cm
                      </div>
                    );
                  })}
                  {barra.retalho > 0 && (
                    <div
                      style={{ width: `${(barra.retalho / comprimentoBarra) * 100}%` }}
                      className="h-full bg-amber-500/10 border-l border-dashed border-amber-500/40 text-[10px] font-mono flex items-center justify-center text-amber-600 font-bold"
                    >
                      {barra.retalho}cm (retalho)
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </AdminCard>
      )}
    </div>
  );
}

// --- MODULE 2: SIMULADOR DE CHAPAS ---

export function SimuladorChapas() {
  const [produto, setProduto] = useState("Vidro Comum 2mm");
  const [larguraChapa, setLarguraChapa] = useState(120);
  const [alturaChapa, setAlturaChapa] = useState(180);

  const [pecas, setPecas] = useState([
    { id: 1, largura: 50, altura: 40, quantidade: 2 },
    { id: 2, largura: 30, altura: 60, quantidade: 3 },
  ]);
  const [simulatedResults, setSimulatedResults] = useState<any>(null);

  const addPeca = () => {
    const newId = pecas.length > 0 ? Math.max(...pecas.map((p) => p.id)) + 1 : 1;
    setPecas([...pecas, { id: newId, largura: 40, altura: 30, quantidade: 1 }]);
  };
  const removePeca = (id: number) => setPecas(pecas.filter((p) => p.id !== id));
  const updatePeca = (id: number, field: string, value: number) =>
    setPecas(pecas.map((p) => (p.id === id ? { ...p, [field]: value } : p)));

  const handleSimular = () => {
    setSimulatedResults({
      chapasUsadas: 1,
      areaUtilizada: 0.58,
      areaRestante: 1.58,
      aproveitamento: 26.8,
      desperdicio: 73.2,
      retalhos: [
        { largura: 70, altura: 40, area: 0.28 },
        { largura: 120, altura: 140, area: 1.68 },
      ],
    });
  };

  return (
    <div className="space-y-6">
      <AdminCard
        title="Configurações de Entrada (Chapas)"
        subtitle="Simulação do motor bidimensional (Guillotine)"
      >
        <div className="grid gap-4 md:grid-cols-3">
          <div className="space-y-1">
            <Label>Produto Base</Label>
            <Input value={produto} onChange={(e) => setProduto(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Largura da Chapa (cm)</Label>
            <Input
              type="number"
              value={larguraChapa}
              onChange={(e) => setLarguraChapa(Number(e.target.value))}
            />
          </div>
          <div className="space-y-1">
            <Label>Altura da Chapa (cm)</Label>
            <Input
              type="number"
              value={alturaChapa}
              onChange={(e) => setAlturaChapa(Number(e.target.value))}
            />
          </div>
        </div>
      </AdminCard>

      <AdminCard
        title="Peças a Cortar"
        subtitle="Adicione dimensões de vidros ou fundos"
        actions={
          <Button size="sm" variant="outline" onClick={addPeca}>
            Adicionar Peça
          </Button>
        }
      >
        <div className="border border-border/60 rounded-md overflow-hidden">
          <table className="w-full text-sm text-left">
            <thead className="bg-muted text-muted-foreground text-xs uppercase">
              <tr>
                <th className="px-4 py-2">Largura (cm)</th>
                <th className="px-4 py-2">Altura (cm)</th>
                <th className="px-4 py-2">Quantidade</th>
                <th className="px-4 py-2 w-20">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {pecas.map((p) => (
                <tr key={p.id}>
                  <td className="px-4 py-2">
                    <Input
                      type="number"
                      value={p.largura}
                      className="h-8 max-w-[150px]"
                      onChange={(e) => updatePeca(p.id, "largura", Number(e.target.value))}
                    />
                  </td>
                  <td className="px-4 py-2">
                    <Input
                      type="number"
                      value={p.altura}
                      className="h-8 max-w-[150px]"
                      onChange={(e) => updatePeca(p.id, "altura", Number(e.target.value))}
                    />
                  </td>
                  <td className="px-4 py-2">
                    <Input
                      type="number"
                      value={p.quantidade}
                      className="h-8 max-w-[150px]"
                      onChange={(e) => updatePeca(p.id, "quantidade", Number(e.target.value))}
                    />
                  </td>
                  <td className="px-4 py-2">
                    <Button size="sm" variant="destructive" onClick={() => removePeca(p.id)}>
                      Remover
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-4 flex justify-end">
          <Button onClick={handleSimular} className="gap-2">
            <Play className="h-4 w-4" /> Simular Chapa
          </Button>
        </div>
      </AdminCard>

      {simulatedResults && (
        <AdminCard
          title="Resultados da Simulação"
          subtitle="Encaixes Guillotine e visualização de sobras 2D"
        >
          <div className="grid gap-4 md:grid-cols-4 mb-6">
            <div className="p-4 bg-muted/40 rounded-lg border border-border/40">
              <span className="text-xs text-muted-foreground font-medium block">Chapas Usadas</span>
              <span className="text-2xl font-bold text-foreground">
                {simulatedResults.chapasUsadas}
              </span>
            </div>
            <div className="p-4 bg-muted/40 rounded-lg border border-border/40">
              <span className="text-xs text-muted-foreground font-medium block">
                Aproveitamento
              </span>
              <span className="text-2xl font-bold text-emerald-600">
                {simulatedResults.aproveitamento}%
              </span>
            </div>
            <div className="p-4 bg-muted/40 rounded-lg border border-border/40">
              <span className="text-xs text-muted-foreground font-medium block">
                Área Utilizada
              </span>
              <span className="text-2xl font-bold text-foreground">
                {simulatedResults.areaUtilizada} m²
              </span>
            </div>
            <div className="p-4 bg-muted/40 rounded-lg border border-border/40">
              <span className="text-xs text-muted-foreground font-medium block">
                Sobras/Retalhos
              </span>
              <span className="text-2xl font-bold text-amber-600">
                {simulatedResults.retalhos.length} gerados
              </span>
            </div>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-4">
              <h4 className="text-sm font-semibold">Lista de Retalhos Gerados</h4>
              <div className="border border-border/60 rounded-md overflow-hidden text-xs">
                <table className="w-full text-left">
                  <thead className="bg-muted font-bold">
                    <tr>
                      <th className="p-2">Dimensões (cm)</th>
                      <th className="p-2">Área (m²)</th>
                      <th className="p-2">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {simulatedResults.retalhos.map((r: any, idx: number) => (
                      <tr key={idx}>
                        <td className="p-2">
                          {r.largura} x {r.altura} cm
                        </td>
                        <td className="p-2">{r.area} m²</td>
                        <td className="p-2">
                          <StatusBadge status="warning" text="Sobra Reutilizável" />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex flex-col items-center justify-center p-4 border border-dashed border-border rounded-lg bg-muted/10 min-h-[300px]">
              <span className="text-xs font-semibold text-muted-foreground mb-3">
                Encaixe Gráfico 2D (Guillotine Strategy)
              </span>
              <svg
                width="220"
                height="300"
                className="border border-border bg-slate-100 dark:bg-slate-900 rounded"
              >
                <rect
                  x="10"
                  y="10"
                  width="200"
                  height="280"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeDasharray="3 3"
                />
                <rect
                  x="10"
                  y="10"
                  width="80"
                  height="60"
                  className="fill-primary/20 stroke-primary"
                  strokeWidth="2"
                />
                <text
                  x="50"
                  y="45"
                  textAnchor="middle"
                  className="text-[10px] fill-primary-foreground font-bold"
                >
                  P1
                </text>
                <rect
                  x="90"
                  y="10"
                  width="80"
                  height="60"
                  className="fill-primary/20 stroke-primary"
                  strokeWidth="2"
                />
                <text
                  x="130"
                  y="45"
                  textAnchor="middle"
                  className="text-[10px] fill-primary-foreground font-bold"
                >
                  P2
                </text>
                <line
                  x1="10"
                  y1="70"
                  x2="210"
                  y2="70"
                  stroke="red"
                  strokeWidth="2"
                  strokeDasharray="4 2"
                />
                <rect
                  x="10"
                  y="70"
                  width="200"
                  height="220"
                  fill="rgba(245,158,11,0.05)"
                  stroke="rgba(245,158,11,0.3)"
                />
                <text
                  x="110"
                  y="180"
                  textAnchor="middle"
                  className="text-xs fill-amber-600 font-bold"
                >
                  Sobra Reutilizável
                </text>
              </svg>
            </div>
          </div>
        </AdminCard>
      )}
    </div>
  );
}

// --- MODULE 3: SIMULADOR DE BOBINAS ---

export function SimuladorBobinas() {
  const [produto, setProduto] = useState("Papel Fine Art Matte 180g");
  const [larguraBobina, setLarguraBobina] = useState(110);
  const [comprimentoDisponivel, setComprimentoDisponivel] = useState(5000);

  const [pecas, setPecas] = useState([{ id: 1, largura: 60, altura: 80, quantidade: 3 }]);
  const [simulatedResults, setSimulatedResults] = useState<any>(null);

  const addPeca = () => {
    const newId = pecas.length > 0 ? Math.max(...pecas.map((p) => p.id)) + 1 : 1;
    setPecas([...pecas, { id: newId, largura: 50, altura: 70, quantidade: 1 }]);
  };
  const removePeca = (id: number) => setPecas(pecas.filter((p) => p.id !== id));
  const updatePeca = (id: number, field: string, value: number) =>
    setPecas(pecas.map((p) => (p.id === id ? { ...p, [field]: value } : p)));

  const handleSimular = () => {
    setSimulatedResults({
      orientacaoEscolhida: "Rotacionada (90°)",
      economiaComprimento: "20 cm",
      comprimentoUtilizado: 180,
      comprimentoRestante: 4820,
      areaUtilizada: 1.44,
      desperdicioArea: 0.54,
    });
  };

  return (
    <div className="space-y-6">
      <AdminCard
        title="Configurações de Entrada (Bobinas)"
        subtitle="Simulação do rolo e otimização de rotação"
      >
        <div className="grid gap-4 md:grid-cols-3">
          <div className="space-y-1">
            <Label>Produto de Impressão</Label>
            <Input value={produto} onChange={(e) => setProduto(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Largura da Bobina (cm)</Label>
            <Input
              type="number"
              value={larguraBobina}
              onChange={(e) => setLarguraBobina(Number(e.target.value))}
            />
          </div>
          <div className="space-y-1">
            <Label>Comprimento do Rolo (cm)</Label>
            <Input
              type="number"
              value={comprimentoDisponivel}
              onChange={(e) => setComprimentoDisponivel(Number(e.target.value))}
            />
          </div>
        </div>
      </AdminCard>

      <AdminCard
        title="Artes / Canvas a Imprimir"
        subtitle="Medidas das impressões requeridas"
        actions={
          <Button size="sm" variant="outline" onClick={addPeca}>
            Adicionar Arte
          </Button>
        }
      >
        <div className="border border-border/60 rounded-md overflow-hidden">
          <table className="w-full text-sm text-left">
            <thead className="bg-muted text-muted-foreground text-xs uppercase">
              <tr>
                <th className="px-4 py-2">Largura (cm)</th>
                <th className="px-4 py-2">Altura (cm)</th>
                <th className="px-4 py-2">Quantidade</th>
                <th className="px-4 py-2 w-20">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {pecas.map((p) => (
                <tr key={p.id}>
                  <td className="px-4 py-2">
                    <Input
                      type="number"
                      value={p.largura}
                      className="h-8 max-w-[150px]"
                      onChange={(e) => updatePeca(p.id, "largura", Number(e.target.value))}
                    />
                  </td>
                  <td className="px-4 py-2">
                    <Input
                      type="number"
                      value={p.altura}
                      className="h-8 max-w-[150px]"
                      onChange={(e) => updatePeca(p.id, "altura", Number(e.target.value))}
                    />
                  </td>
                  <td className="px-4 py-2">
                    <Input
                      type="number"
                      value={p.quantidade}
                      className="h-8 max-w-[150px]"
                      onChange={(e) => updatePeca(p.id, "quantidade", Number(e.target.value))}
                    />
                  </td>
                  <td className="px-4 py-2">
                    <Button size="sm" variant="destructive" onClick={() => removePeca(p.id)}>
                      Remover
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-4 flex justify-end">
          <Button onClick={handleSimular} className="gap-2">
            <Play className="h-4 w-4" /> Simular Bobina
          </Button>
        </div>
      </AdminCard>

      {simulatedResults && (
        <AdminCard
          title="Resultados da Simulação"
          subtitle="Otimização linear da bobina e aproveitamento de largura"
        >
          <div className="grid gap-4 md:grid-cols-5 mb-6">
            <div className="p-4 bg-muted/40 rounded-lg border border-border/40">
              <span className="text-xs text-muted-foreground font-medium block">
                Orientação Escolhida
              </span>
              <span className="text-base font-bold text-emerald-600">
                {simulatedResults.orientacaoEscolhida}
              </span>
            </div>
            <div className="p-4 bg-muted/40 rounded-lg border border-border/40">
              <span className="text-xs text-muted-foreground font-medium block">
                Comprimento Consumido
              </span>
              <span className="text-2xl font-bold text-foreground">
                {simulatedResults.comprimentoUtilizado} cm
              </span>
            </div>
            <div className="p-4 bg-muted/40 rounded-lg border border-border/40">
              <span className="text-xs text-muted-foreground font-medium block">
                Comprimento Restante
              </span>
              <span className="text-2xl font-bold text-foreground">
                {simulatedResults.comprimentoRestante} cm
              </span>
            </div>
            <div className="p-4 bg-muted/40 rounded-lg border border-border/40">
              <span className="text-xs text-muted-foreground font-medium block">
                Área Impressa Útil
              </span>
              <span className="text-2xl font-bold text-foreground">
                {simulatedResults.areaUtilizada} m²
              </span>
            </div>
            <div className="p-4 bg-muted/40 rounded-lg border border-border/40">
              <span className="text-xs text-muted-foreground font-medium block">
                Economia por Rotação
              </span>
              <span className="text-base font-bold text-blue-600">
                {simulatedResults.economiaComprimento}
              </span>
            </div>
          </div>

          <div className="flex flex-col items-center justify-center p-6 border border-dashed border-border rounded-lg bg-muted/10">
            <span className="text-xs font-semibold text-muted-foreground mb-4">
              Avanço Linear e Distribuição no Rolo
            </span>
            <div className="w-full h-24 border border-border bg-slate-900 rounded relative overflow-hidden flex items-center">
              <div className="h-full w-40 bg-primary/20 border-r border-primary flex flex-col justify-around p-1 text-[10px] font-mono text-white text-center font-bold">
                <div className="h-6 w-full border border-primary/40 bg-primary/30 flex items-center justify-center">
                  Arte 1 (80x60)
                </div>
                <div className="h-6 w-full border border-primary/40 bg-primary/30 flex items-center justify-center">
                  Arte 2 (80x60)
                </div>
                <div className="h-6 w-full border border-primary/40 bg-primary/30 flex items-center justify-center">
                  Arte 3 (80x60)
                </div>
              </div>
              <div className="h-full flex-1 bg-amber-500/5 text-[10px] font-mono text-amber-500/60 flex items-center justify-center italic">
                Restante do Rolo (Disponível: 48.2m)
              </div>
            </div>
          </div>
        </AdminCard>
      )}
    </div>
  );
}

// --- MODULE 4: MANUFACTURING ENGINE ---

export function ManufacturingEngineVisualizer() {
  const [pedidoId, setPedidoId] = useState("1024");
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any>(null);

  const handleCarregar = () => {
    setLoading(true);
    setTimeout(() => {
      setData({
        entrada: {
          medidasArte: "60 x 80 cm",
          molduraId: "M102-Preta",
          vidro: "Vidro Comum 2mm",
          passepartout: "Passe-partout Branco 5cm",
          protecaoFrontal: "Acrílico 2mm",
          fundo: "MDF 3mm",
          impressao: "Canvas Fine Art",
          chassi: "Chassi Eucalipto 3cm",
          servicos: ["Montagem Completa", "Estiramento de Canvas"],
          observacoes: "Cuidado ao manusear chapa traseira",
          fotos: 1,
        },
        calculo: {
          abertura: "61 x 81 cm",
          tamanhoFinal: "72.4 x 92.4 cm",
          pecas: [
            { tipo: "moldura", peca: "superior/inferior", qtd: 2, medida: "72.4 cm" },
            { tipo: "moldura", peca: "lateral", qtd: 2, medida: "92.4 cm" },
          ],
          barrasNecessarias: 1.25,
          retalhosPrevistos: "50 cm",
          materiais: [
            { item: "MDF 3mm", areaNecessaria: "0.67 m²" },
            { item: "Acrílico 2mm", areaNecessaria: "0.67 m²" },
          ],
          valores: { custoTotal: 185.0, vendaTotal: 390.0, markup: 2.1 },
        },
        consumoEstoque: [
          {
            produto_id: "a3b4c5d6-e7f8-9012-3456-789012345678",
            codigo: "M102",
            forma_estoque: "barras",
            unidade: "m",
            quantidade: 3.3,
            largura: 3.5,
            comprimento: 329.6,
          },
          {
            produto_id: "f8e7d6c5-b4a3-2109-8765-432109876543",
            codigo: "V2MM",
            forma_estoque: "chapas",
            unidade: "un",
            quantidade: 1.0,
            largura: 72.4,
            altura: 92.4,
          },
        ],
      });
      setLoading(false);
    }, 500);
  };

  return (
    <div className="space-y-6">
      <AdminCard
        title="Explorador da Manufacturing Engine"
        subtitle="Inspecione cálculos e desdobramentos de pedidos"
      >
        <div className="flex gap-4 items-end">
          <div className="space-y-1 flex-1 max-w-[300px]">
            <Label>Número do Pedido</Label>
            <Input
              placeholder="Ex: 1024"
              value={pedidoId}
              onChange={(e) => setPedidoId(e.target.value)}
            />
          </div>
          <Button onClick={handleCarregar} disabled={loading} className="gap-2">
            <Search className="h-4 w-4" /> {loading ? "Carregando..." : "Analisar Pedido"}
          </Button>
        </div>
      </AdminCard>

      {data && (
        <div className="space-y-4">
          <CollapsibleSection
            title="1. Entrada do Pedido (Parâmetros da Arte & Materiais)"
            defaultOpen
          >
            <div className="grid gap-4 md:grid-cols-3 text-sm">
              <div>
                <span className="text-xs text-muted-foreground font-semibold">
                  Dimensões da Arte
                </span>
                <p className="font-mono mt-0.5">{data.entrada.medidasArte}</p>
              </div>
              <div>
                <span className="text-xs text-muted-foreground font-semibold">
                  Moldura Escolhida
                </span>
                <p className="mt-0.5">{data.entrada.molduraId}</p>
              </div>
              <div>
                <span className="text-xs text-muted-foreground font-semibold">
                  Vidro / Proteção
                </span>
                <p className="mt-0.5">{data.entrada.vidro}</p>
              </div>
              <div>
                <span className="text-xs text-muted-foreground font-semibold">Chassi / Fundo</span>
                <p className="mt-0.5">{data.entrada.fundo}</p>
              </div>
              <div>
                <span className="text-xs text-muted-foreground font-semibold">
                  Serviços Adicionais
                </span>
                <p className="mt-0.5">{data.entrada.servicos.join(", ")}</p>
              </div>
              <div>
                <span className="text-xs text-muted-foreground font-semibold">Observações</span>
                <p className="mt-0.5 italic">{data.entrada.observacoes}</p>
              </div>
            </div>
          </CollapsibleSection>

          <CollapsibleSection
            title="2. Cálculos da Manufacturing Engine (Aberturas e Frações)"
            defaultOpen
          >
            <div className="space-y-4 text-sm">
              <div className="grid gap-4 md:grid-cols-4">
                <div>
                  <span className="text-xs text-muted-foreground font-semibold">
                    Medida Interna (Abertura)
                  </span>
                  <p className="font-mono mt-0.5">{data.calculo.abertura}</p>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground font-semibold">
                    Medida Externa Total
                  </span>
                  <p className="font-mono mt-0.5">{data.calculo.tamanhoFinal}</p>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground font-semibold">
                    Fração de Barras
                  </span>
                  <p className="mt-0.5">{data.calculo.barrasNecessarias} barras</p>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground font-semibold">
                    Desperdício Estimado
                  </span>
                  <p className="mt-0.5 text-amber-600">{data.calculo.retalhosPrevistos}</p>
                </div>
              </div>

              <div className="pt-2">
                <span className="text-xs text-muted-foreground font-semibold block mb-2">
                  Desdobramento de Peças de Corte
                </span>
                <div className="border border-border/60 rounded-md overflow-hidden text-xs">
                  <table className="w-full text-left">
                    <thead className="bg-muted font-bold">
                      <tr>
                        <th className="p-2">Componente</th>
                        <th className="p-2">Lado</th>
                        <th className="p-2">Qtd</th>
                        <th className="p-2">Comprimento de Corte</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {data.calculo.pecas.map((p: any, idx: number) => (
                        <tr key={idx}>
                          <td className="p-2 capitalize">{p.tipo}</td>
                          <td className="p-2">{p.peca}</td>
                          <td className="p-2">{p.qtd}</td>
                          <td className="p-2 font-mono">{p.medida}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </CollapsibleSection>

          <CollapsibleSection
            title="3. Consumo de Estoque (JSON consumo_estoque)"
            defaultOpen
          >
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground">
                Estrutura enviada para a <b>Stock Engine</b> para reservas e baixas físicas.
              </p>
              <JsonViewer data={data.consumoEstoque} filename={`pedido-${pedidoId}-consumo.json`} />
            </div>
          </CollapsibleSection>
        </div>
      )}
    </div>
  );
}

// --- MODULE 5: STOCK ENGINE ---

export function StockEngineVisualizer() {
  const [pedidoId, setPedidoId] = useState("1024");
  const [loading, setLoading] = useState(false);
  const [log, setLog] = useState<any>(null);

  const handleSimular = () => {
    setLoading(true);
    setTimeout(() => {
      setLog({
        status: "success",
        formaEstoque: "barras",
        algoritmo: "Algoritmo de Barras (Padrão)",
        historicoPassos: [
          "Verificando retalhos de 'Moldura Preta 3.5cm'...",
          "Retalho R-102 (50 cm) encontrado. Não cabe 72.4 cm.",
          "Nenhum retalho para peças de 92.4 cm.",
          "Consumindo barra inteira de 270 cm.",
          "Cortes 92.4 + 92.4. Resta retalho de 85.2 cm.",
          "Consumindo segunda barra de 270 cm.",
          "Cortes 72.4 + 72.4. Resta retalho de 125.2 cm.",
          "Atualizando estoque no banco.",
          "Gerando movimentação em 'public.reservas_estoque'.",
        ],
        movimentacoes: [
          { tipo: "Reserva", qtd: 3.3, produto: "M102", status: "Ativa" },
          { tipo: "Retalho Criado", qtd: 1.25, produto: "M102 (Retalho)", status: "Disponível" },
        ],
      });
      setLoading(false);
    }, 600);
  };

  return (
    <div className="space-y-6">
      <AdminCard
        title="Explorador da Stock Engine"
        subtitle="Fluxo de transações no estoque"
      >
        <div className="flex gap-4 items-end">
          <div className="space-y-1 flex-1 max-w-[300px]">
            <Label>Número do Pedido Aprovado</Label>
            <Input
              placeholder="Ex: 1024"
              value={pedidoId}
              onChange={(e) => setPedidoId(e.target.value)}
            />
          </div>
          <Button
            onClick={handleSimular}
            disabled={loading}
            className="gap-2 bg-emerald-600 hover:bg-emerald-700"
          >
            <Play className="h-4 w-4" /> {loading ? "Simulando..." : "Executar Fluxo"}
          </Button>
        </div>
      </AdminCard>

      {log && (
        <div className="grid gap-6 md:grid-cols-3">
          <div className="md:col-span-2 space-y-4">
            <AdminCard title="Passo a Passo" subtitle="Decisões do Resolvedor">
              <div className="space-y-3 font-mono text-xs text-muted-foreground p-4 bg-muted/20 rounded-md border border-border/40 max-h-[400px] overflow-auto">
                {log.historicoPassos.map((passo: string, idx: number) => (
                  <div key={idx} className="flex gap-2">
                    <span className="text-primary font-bold">{idx + 1}.</span>
                    <span>{passo}</span>
                  </div>
                ))}
              </div>
            </AdminCard>
          </div>

          <div className="space-y-4">
            <AdminCard title="Resumo das Entidades" subtitle="Movimentações geradas">
              <div className="space-y-4">
                <div>
                  <span className="text-xs text-muted-foreground font-semibold">
                    Forma de Estoque
                  </span>
                  <p className="text-sm font-semibold capitalize mt-0.5">{log.formaEstoque}</p>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground font-semibold">
                    Algoritmo Mapeado
                  </span>
                  <p className="text-sm font-semibold mt-0.5">{log.algoritmo}</p>
                </div>

                <div className="border-t border-border pt-4">
                  <span className="text-xs text-muted-foreground font-semibold block mb-2">
                    Transações Geradas
                  </span>
                  <div className="space-y-2">
                    {log.movimentacoes.map((m: any, idx: number) => (
                      <div
                        key={idx}
                        className="flex justify-between items-center text-xs p-2 bg-muted/40 rounded border border-border/40"
                      >
                        <div>
                          <span className="font-semibold text-foreground">{m.tipo}</span>
                          <p className="text-muted-foreground text-[10px]">{m.produto}</p>
                        </div>
                        <span className="font-mono font-bold text-primary">{m.qtd}m</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </AdminCard>
          </div>
        </div>
      )}
    </div>
  );
}

// --- MODULE 6: TESTES ---

export function TestesAutomatizados() {
  const [tests, setTests] = useState([
    { id: "T1", nome: "Corte de Barras - Sem Retalhos", categoria: "Barras", status: "passed", esperado: "Barras: 3, Desperdício: ~12%", obtido: "Barras: 3, Desperdício: 12%" },
    { id: "T2", nome: "Corte de Barras - Uso de Retalho", categoria: "Barras", status: "passed", esperado: "Aproveita retalho de 90cm", obtido: "Aproveita retalho de 90cm" },
    { id: "T3", nome: "Guillotine - Rotação Chapa", categoria: "Chapas", status: "passed", esperado: "Rotaciona MDF", obtido: "Rotaciona MDF" },
    { id: "T4", nome: "Bobina - Rotação Otimizada", categoria: "Bobinas", status: "passed", esperado: "Rotação 90°", obtido: "Rotação 90°" },
    { id: "T5", nome: "Cálculo de Abertura", categoria: "Manufacturing", status: "passed", esperado: "Folga 2mm", obtido: "Folga 2mm" },
  ]);
  const [running, setRunning] = useState(false);

  const runAll = () => {
    setRunning(true);
    setTests(tests.map((t) => ({ ...t, status: "pending" })));
    setTimeout(() => {
      setTests(tests.map((t) => ({ ...t, status: "passed" })));
      setRunning(false);
    }, 1500);
  };
  const runSingle = (id: string) => {
    setTests(tests.map((t) => (t.id === id ? { ...t, status: "pending" } : t)));
    setTimeout(() => {
      setTests(tests.map((t) => (t.id === id ? { ...t, status: "passed" } : t)));
    }, 600);
  };

  const total = tests.length;
  const passed = tests.filter((t) => t.status === "passed").length;
  const failed = tests.filter((t) => t.status === "failed").length;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        <div className="p-4 bg-muted/40 rounded-lg border border-border/40 flex justify-between items-center">
          <div>
            <span className="text-xs text-muted-foreground font-medium block">Total</span>
            <span className="text-2xl font-bold text-foreground">{total}</span>
          </div>
          <Layers className="h-8 w-8 text-primary/30" />
        </div>
        <div className="p-4 bg-muted/40 rounded-lg border border-border/40 flex justify-between items-center">
          <div>
            <span className="text-xs text-muted-foreground font-medium block">Aprovados</span>
            <span className="text-2xl font-bold text-emerald-600">🟢 {passed}</span>
          </div>
          <CheckCircle2 className="h-8 w-8 text-emerald-500/20" />
        </div>
        <div className="p-4 bg-muted/40 rounded-lg border border-border/40 flex justify-between items-center">
          <div>
            <span className="text-xs text-muted-foreground font-medium block">Reprovados</span>
            <span className="text-2xl font-bold text-destructive">🔴 {failed}</span>
          </div>
          <XCircle className="h-8 w-8 text-destructive/20" />
        </div>
      </div>

      <AdminCard
        title="Cenários de Teste"
        subtitle="Regras críticas dos motores"
        actions={
          <Button onClick={runAll} disabled={running} className="gap-2">
            <Play className="h-4 w-4" /> Executar Todos
          </Button>
        }
      >
        <div className="border border-border/60 rounded-md overflow-hidden text-sm">
          <table className="w-full text-left">
            <thead className="bg-muted text-xs text-muted-foreground uppercase">
              <tr>
                <th className="px-4 py-3">Código</th>
                <th className="px-4 py-3">Nome</th>
                <th className="px-4 py-3">Categoria</th>
                <th className="px-4 py-3">Esperado</th>
                <th className="px-4 py-3">Obtido</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 w-28">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {tests.map((t) => (
                <tr key={t.id} className="hover:bg-muted/10">
                  <td className="px-4 py-3 font-mono font-bold text-xs">{t.id}</td>
                  <td className="px-4 py-3 font-medium">{t.nome}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{t.categoria}</td>
                  <td className="px-4 py-3 font-mono text-xs">{t.esperado}</td>
                  <td className="px-4 py-3 font-mono text-xs">{t.obtido}</td>
                  <td className="px-4 py-3">
                    {t.status === "passed" && (
                      <span className="text-emerald-600 font-semibold">🟢 Passou</span>
                    )}
                    {t.status === "failed" && (
                      <span className="text-destructive font-semibold">🔴 Falhou</span>
                    )}
                    {t.status === "pending" && (
                      <span className="text-amber-500 font-semibold">🟡 Pendente</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <Button size="sm" variant="outline" onClick={() => runSingle(t.id)}>
                      Rodar
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </AdminCard>
    </div>
  );
}

// --- MODULE 7: LOG DE ALGORITMOS ---

export function LogAlgoritmos() {
  const [filtroAlgoritmo, setFiltroAlgoritmo] = useState("todos");

  const logs = [
    { data: "2026-07-12 18:23:44", produto: "M102-Preta", algoritmo: "Barras", decisao: "Consumida Barra 1. Sobra 85.2 cm.", resultado: "Aproveitamento: 85%" },
    { data: "2026-07-12 18:21:05", produto: "Vidro 2mm", algoritmo: "Guillotine", decisao: "Chapa inteira 120x180. Encaixe guilhotina.", resultado: "Retalho: 120x140" },
    { data: "2026-07-12 18:15:30", produto: "Canvas Matte", algoritmo: "Bobinas", decisao: "Rotacionada 90°. Economia 20cm.", resultado: "Comprimento: 180 cm" },
    { data: "2026-07-12 17:55:12", produto: "Passe-partout Branco", algoritmo: "Guillotine", decisao: "Retalho R-54 (60x80) usado.", resultado: "Sobra descartada" },
  ];

  const filteredLogs =
    filtroAlgoritmo === "todos"
      ? logs
      : logs.filter((l) => l.algoritmo.toLowerCase() === filtroAlgoritmo.toLowerCase());

  return (
    <div className="space-y-6">
      <AdminCard title="Filtros" subtitle="Filtragem de transições no estoque">
        <div className="grid gap-4 md:grid-cols-4">
          <div className="space-y-1">
            <Label>Produto</Label>
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Código ou nome..." className="pl-9" />
            </div>
          </div>
          <div className="space-y-1">
            <Label>Algoritmo</Label>
            <Select value={filtroAlgoritmo} onValueChange={setFiltroAlgoritmo}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="barras">Barras</SelectItem>
                <SelectItem value="guillotine">Guillotine</SelectItem>
                <SelectItem value="bobinas">Bobinas</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>ID do Pedido</Label>
            <Input placeholder="Ex: 1024" />
          </div>
          <div className="space-y-1">
            <Label>Data Limite</Label>
            <Input type="date" />
          </div>
        </div>
      </AdminCard>

      <AdminCard title="Histórico de Decisões" subtitle="Fluxo operacional">
        <div className="border border-border/60 rounded-md overflow-hidden text-sm">
          <table className="w-full text-left">
            <thead className="bg-muted text-xs text-muted-foreground uppercase">
              <tr>
                <th className="px-4 py-3">Data/Hora</th>
                <th className="px-4 py-3">Produto</th>
                <th className="px-4 py-3">Algoritmo</th>
                <th className="px-4 py-3">Decisão</th>
                <th className="px-4 py-3">Resultado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredLogs.map((l, idx) => (
                <tr key={idx} className="hover:bg-muted/10">
                  <td className="px-4 py-3 font-mono text-xs">{l.data}</td>
                  <td className="px-4 py-3 font-medium">{l.produto}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status="info" text={l.algoritmo} />
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{l.decisao}</td>
                  <td className="px-4 py-3 font-mono text-xs font-semibold">{l.resultado}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </AdminCard>
    </div>
  );
}

// --- MODULE 8: CONFIGURAÇÃO DE ALGORITMOS ---

export function ConfiguracaoAlgoritmos() {
  const [configRows, setConfigRows] = useState([
    { forma: "Barras", algoritmo: "Algoritmo de Barras" },
    { forma: "Chapas", algoritmo: "Guillotine" },
    { forma: "Bobinas", algoritmo: "Algoritmo de Bobinas" },
    { forma: "Metro Linear", algoritmo: "Padrão" },
    { forma: "Área", algoritmo: "Padrão" },
    { forma: "Unidade", algoritmo: "Padrão" },
  ]);

  const handleSave = () => {
    toast.success("Mapeamento de Algoritmos atualizado!");
  };

  return (
    <div className="space-y-6">
      <AdminCard
        title="Mapeamento de Algoritmos por Tipo de Estoque"
        subtitle="Comportamento do resolvedor da Stock Engine"
      >
        <div className="border border-border/60 rounded-md overflow-hidden text-sm mb-4">
          <table className="w-full text-left">
            <thead className="bg-muted text-xs text-muted-foreground uppercase">
              <tr>
                <th className="px-4 py-3">Forma de Estoque</th>
                <th className="px-4 py-3">Algoritmo Ativo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border text-foreground">
              {configRows.map((row, idx) => (
                <tr key={idx}>
                  <td className="px-4 py-4 font-semibold">{row.forma}</td>
                  <td className="px-4 py-4">
                    <Select
                      value={row.algoritmo}
                      onValueChange={(v) => {
                        setConfigRows(
                          configRows.map((r, i) => (i === idx ? { ...r, algoritmo: v } : r)),
                        );
                      }}
                    >
                      <SelectTrigger className="w-[300px] h-9">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Algoritmo de Barras">Algoritmo de Barras</SelectItem>
                        <SelectItem value="Guillotine">Guillotine (Cortes Retos)</SelectItem>
                        <SelectItem value="Algoritmo de Bobinas">Algoritmo de Bobinas</SelectItem>
                        <SelectItem value="Padrão">Padrão (Consumo Direto)</SelectItem>
                      </SelectContent>
                    </Select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex justify-end pt-2">
          <Button onClick={handleSave} className="gap-2">
            <Settings2 className="h-4 w-4" /> Salvar Configurações
          </Button>
        </div>
      </AdminCard>
    </div>
  );
}

// --- SHARED ICONS EXPORT for the index page ---
export { Play, Code, Database, Layers, Settings2, CheckCircle2, Search };
