import type { Metadata, Viewport } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { GeistMono } from "geist/font/mono";
import { GeistSans } from "geist/font/sans";
import { Toaster } from "sonner";
import { Providers } from "@/components/providers";
import "./globals.css";

const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(appUrl),
  title: {
    default: "LendLoop — Borrow what you need. Lend what you don't.",
    template: "%s · LendLoop",
  },
  description:
    "A neighborhood tool board for borrowing what you need and lending what sits idle. Sign in to list, request, and return tools.",
  openGraph: {
    title: "LendLoop",
    description:
      "Borrow what you need. Lend what you don't. A calmer neighborhood tool board.",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f4f6f0" },
    { media: "(prefers-color-scheme: dark)", color: "#111713" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <ClerkProvider
      appearance={{
        variables: {
          colorPrimary: "var(--moss)",
          colorBackground: "var(--surface)",
          colorForeground: "var(--ink)",
          colorMutedForeground: "var(--muted)",
          colorInput: "var(--paper)",
          colorInputForeground: "var(--ink)",
          colorBorder: "var(--line)",
          borderRadius: "0.75rem",
          fontFamily: "var(--font-geist-sans)",
        },
        elements: {
          userButtonPopoverCard: {
            backgroundColor: "var(--surface)",
            borderColor: "var(--line)",
            color: "var(--ink)",
          },
          userButtonPopoverMain: {
            backgroundColor: "var(--surface)",
            color: "var(--ink)",
          },
          userButtonPopoverActionButton: {
            color: "var(--ink)",
          },
          userButtonPopoverActionButtonIcon: {
            color: "var(--muted)",
          },
          userButtonPopoverActionButtonIconBox: {
            color: "var(--muted)",
          },
          userButtonPopoverFooter: {
            backgroundColor: "transparent",
            color: "var(--muted)",
          },
          userPreviewMainIdentifier: {
            color: "var(--ink)",
          },
          userPreviewMainIdentifierText: {
            color: "var(--ink)",
          },
          userPreviewSecondaryIdentifier: {
            color: "var(--muted)",
          },
        },
      }}
    >
      <html
        lang="en"
        data-scroll-behavior="smooth"
        className={`${GeistSans.variable} ${GeistMono.variable}`}
      >
        <body>
          <Providers>{children}</Providers>
          <Toaster
            position="top-center"
            theme="system"
            toastOptions={{
              style: {
                background: "var(--surface)",
                color: "var(--ink)",
                border: "1px solid var(--line)",
              },
            }}
          />
        </body>
      </html>
    </ClerkProvider>
  );
}
