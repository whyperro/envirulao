"use client"
import dynamic from "next/dynamic";

const MesaClient = dynamic(() => import("./MesaClient"), {
  ssr: false,
});

export default function MesaPageWrapper() {
  return <MesaClient />;
}
