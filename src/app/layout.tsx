import "./globals.css";

export const metadata = {
  title: "SignLangVisual",
  description: "Web-based FSL recognition system"
};

export default function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
