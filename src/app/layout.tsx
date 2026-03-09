import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
    title: "Bodhi | Sovereign Scan",
    description: "Architect of the Software as Glass philosophy. Collapse the latency between intent and execution.",
};

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="en">
            <body className="antialiased">
                {children}
            </body>
        </html>
    );
}
