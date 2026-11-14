// Biblioteca: músicas embutidas (domínio público) + músicas importadas pelo aluno.

import { construirMusica } from './construir'
import type { MusicaJson } from './construir'
import type { Categoria, MusicaDef } from './tipos'
import { lerMusicasImportadas } from '../treino/armazenamento'

const arquivos = import.meta.glob('../../content/songs/*.json', { eager: true, import: 'default' }) as Record<string, MusicaJson>

export const MUSICAS_EMBUTIDAS: MusicaDef[] = Object.keys(arquivos)
  .sort()
  .map((k) => construirMusica(arquivos[k]))

export const CATEGORIAS: { id: Categoria; titulo: string; descricao: string; importacao?: boolean }[] = [
  { id: 'classicas', titulo: 'Músicas famosas de piano (clássicas)', descricao: 'Obras em domínio público, em versões simplificadas.' },
  { id: 'infantis', titulo: 'Cantigas e músicas infantis', descricao: 'Folclore e melodias tradicionais.' },
  { id: 'natal', titulo: 'Natal', descricao: 'Músicas de Natal em domínio público.' },
  { id: 'festas', titulo: 'Festas e cerimônias', descricao: 'Músicas para ocasiões especiais.' },
  {
    id: 'gonzaga',
    titulo: 'Músicas de Luiz Gonzaga',
    descricao: 'As músicas de Luiz Gonzaga têm direitos autorais, por isso não vêm prontas no app. Importe um arquivo MIDI (.mid) que você tenha e o professor ensina do mesmo jeito.',
    importacao: true,
  },
  {
    id: 'moderno',
    titulo: 'Piano moderno',
    descricao: 'Músicas modernas (filmes, pop, instrumentais) têm direitos autorais. Importe o seu arquivo MIDI (.mid) e pratique com todos os modos.',
    importacao: true,
  },
  { id: 'importadas', titulo: 'Minhas músicas importadas', descricao: 'Arquivos MIDI ou texto que você importou.', importacao: true },
]

export function todasAsMusicas(): MusicaDef[] {
  return [...MUSICAS_EMBUTIDAS, ...lerMusicasImportadas()]
}

export function acharMusica(id: string): MusicaDef | undefined {
  return todasAsMusicas().find((m) => m.id === id)
}
