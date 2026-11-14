import { HashRouter, Route, Routes } from 'react-router-dom'
import { ProgressProvider } from './lib/ProgressContext'
import Layout from './components/Layout'
import Painel from './pages/Painel'
import ModuloPagina from './pages/ModuloPagina'
import AulaPagina from './pages/AulaPagina'
import Progresso from './pages/Progresso'
import EmConstrucao from './pages/EmConstrucao'
import Biblioteca from './pages/Biblioteca'
import MusicaDetalhe from './pages/MusicaDetalhe'
import Tocar from './pages/Tocar'
import Importar from './pages/Importar'
import MeuProgresso from './pages/MeuProgresso'
import Configuracoes from './pages/Configuracoes'

export default function App() {
  return (
    <ProgressProvider>
      <HashRouter>
        <Routes>
          {/* tela de tocar ocupa a tela toda (cabe no iPhone deitado) */}
          <Route path="tocar/:id" element={<Tocar />} />
          <Route element={<Layout />}>
            <Route index element={<Painel />} />
            <Route path="modulo/:id" element={<ModuloPagina />} />
            <Route path="aula/:id" element={<AulaPagina />} />
            <Route path="progresso" element={<Progresso />} />
            <Route
              path="dicionario"
              element={<EmConstrucao titulo="Dicionário musical" etapa={2} descricao="Aqui vão ficar os termos musicais (acorde, oitava, semitom, BPM...) e as funções do CT-S300, explicados de forma simples." />}
            />
            <Route path="musicas" element={<Biblioteca />} />
            <Route path="musica/:id" element={<MusicaDetalhe />} />
            <Route path="importar" element={<Importar />} />
            <Route path="meu-progresso" element={<MeuProgresso />} />
            <Route path="config" element={<Configuracoes />} />
            <Route
              path="admin"
              element={<EmConstrucao titulo="Administração" etapa={5} descricao="O painel para editar aulas e músicas depende de login e banco de dados (ex.: Supabase), que ainda não foram configurados." />}
            />
            <Route path="*" element={<EmConstrucao titulo="Página não encontrada" etapa={1} descricao="Este endereço não existe. Volte ao painel." />} />
          </Route>
        </Routes>
      </HashRouter>
    </ProgressProvider>
  )
}
