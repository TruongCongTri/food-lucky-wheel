// src/lib/discography.ts
export interface Track {
  id: string;
  title: string;
  url: string;
}

export interface Album {
  id: string;
  title: string;
  artist: string;
  year?: number;
  coverUrl: string;
  tracks: Track[];
}

const CDN_URL = process.env.NEXT_PUBLIC_R2_PUBLIC_URL || "";

export const DISCOGRAPHY: Album[] = [
  {
    id: "antiphon",
    title: "Antiphon",
    artist: "Alfa Mist",
    year: 2017,
    coverUrl: "${CDN_URL}/albums/antiphon/cover.webp",
    tracks: [
      {
        id: "alfa-mist-antiphon-2017-full-album",
        title: "Alfa Mist Antiphon 2017 Full Album",
        url: "${CDN_URL}/albums/antiphon/alfa-mist-antiphon-2017-full-album.m4a",
      },
    ],
  },
  {
    id: "bring-backs",
    title: "Bring Backs",
    artist: "Alfa Mist",
    year: 2021,
    coverUrl: "${CDN_URL}/albums/bring-backs/cover.webp",
    tracks: [
      {
        id: "alfa-mist-bring-backs-2021-full-album",
        title: "Alfa Mist Bring Backs 2021 Full Album",
        url: "${CDN_URL}/albums/bring-backs/alfa-mist-bring-backs-2021-full-album.m4a",
      },
    ],
  },
  {
    id: "epoch",
    title: "Epoch",
    artist: "Alfa Mist",
    year: 2020,
    coverUrl: "${CDN_URL}/albums/epoch/cover.webp",
    tracks: [
      {
        id: "alfa-mist-epoch-2020-full-album",
        title: "Alfa Mist Epoch 2020 Full Album",
        url: "${CDN_URL}/albums/epoch/alfa-mist-epoch-2020-full-album.m4a",
      },
    ],
  },
  {
    id: "roulette",
    title: "Roulette",
    artist: "Alfa Mist",
    year: 2025,
    coverUrl: "${CDN_URL}/albums/roulette/cover.webp",
    tracks: [
      {
        id: "alfa-mist-roulette-2025-full-album",
        title: "Alfa Mist Roulette 2025 Full Album",
        url: "${CDN_URL}/albums/roulette/alfa-mist-roulette-2025-full-album.m4a",
      },
    ],
  },
  {
    id: "structuralism",
    title: "Structuralism",
    artist: "Alfa Mist",
    year: 2019,
    coverUrl: "${CDN_URL}/albums/structuralism/cover.webp",
    tracks: [
      {
        id: "alfa-mist-structuralism-2019-full-album",
        title: "Alfa Mist Structuralism 2019 Full Album",
        url: "${CDN_URL}/albums/structuralism/alfa-mist-structuralism-2019-full-album.m4a",
      },
    ],
  },
  {
    id: "variables",
    title: "Variables",
    artist: "Alfa Mist",
    year: 2023,
    coverUrl: "${CDN_URL}/albums/variables/cover.webp",
    tracks: [
      {
        id: "alfa-mist-variables-2023-full-album",
        title: "Alfa Mist Variables 2023 Full Album",
        url: "${CDN_URL}/albums/variables/alfa-mist-variables-2023-full-album.m4a",
      },
    ],
  },
];
