import type { Metadata } from "next";
import { ClientForm } from "@/components/admin/ClientForm";
import { Crumbs } from "@/components/admin/ui";

export const metadata: Metadata = { title: "New client" };

export default function NewClientPage() {
  return (
    <>
      <Crumbs items={[{ href: "/admin", label: "Clients" }, { label: "New" }]} />
      <h1 className="mb-8 font-serif text-5xl leading-none">New client</h1>
      <ClientForm />
    </>
  );
}
