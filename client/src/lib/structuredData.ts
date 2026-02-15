const SCHEMA_ID = "schema-web-application";

const WEB_APP_SCHEMA: Record<string, unknown> = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "Solo Dev System",
  url: "https://solodev.app",
  description:
    "Plataforma gamificada de estudo com progressao RPG, revisao espacada, quests diarias e IA.",
  applicationCategory: "EducationalApplication",
  operatingSystem: "Web",
  inLanguage: "pt-BR",
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "BRL",
  },
};

export function injectStructuredData(): void {
  if (typeof document === "undefined") {
    return;
  }

  if (document.getElementById(SCHEMA_ID)) {
    return;
  }

  const tag = document.createElement("script");
  tag.id = SCHEMA_ID;
  tag.type = "application/ld+json";
  tag.text = JSON.stringify(WEB_APP_SCHEMA);
  document.head.appendChild(tag);
}
