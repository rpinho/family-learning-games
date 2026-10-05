import type { Metadata } from "next";
import SlalomApp from '../SlalomApp';
// Letter Slalom's own light entry (the hub card opens /?play=slalom; the game server maps it here): a snowy loading screen
// from the server, then only the slalom's code. Word Arcade's shell, menus and games are never loaded.
export const metadata: Metadata = { title: "Letter Slalom", description: "Ski down the mountain through the letter you hear." };
export default function Page(){return <SlalomApp/>;}
