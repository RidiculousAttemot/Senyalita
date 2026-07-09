import "./globals.css";

export const metadata = {
  title: "Senyalita",
  description: "Filipino Sign Language recognition and learning assistant"
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
