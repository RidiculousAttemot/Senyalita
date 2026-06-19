import "./globals.css";

export const metadata = {
  title: "SignLangVisual — Filipino Sign Language Recognition",
  description: "Real-time FSL gesture recognition using AI. Break communication barriers between Deaf, Hard-of-Hearing, and hearing individuals."
};

export default function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        {children}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                window.addEventListener('load', function() {
                  navigator.serviceWorker.register('/sw.js');
                });
              }
            `,
          }}
        />
      </body>
    </html>
  );
}
