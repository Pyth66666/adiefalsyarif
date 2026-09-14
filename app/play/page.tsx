import type { Metadata } from "next";
import { SpaceDodger } from "@/components/arcade/SpaceDodger";
export const metadata: Metadata = { title: "Pocket Orbit — Adief's Arcade", description: "Collect lost signals. Dodge asteroids. A pocket-sized space arcade." };
export default function PlayPage() { return <SpaceDodger />; }
