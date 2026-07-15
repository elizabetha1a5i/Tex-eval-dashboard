export const metadata = {
  title: "Tex Eval Dashboard",
  description: "Weber Ranch Tex — dynamic eval results",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: "system-ui, sans-serif", background: "#f5f6fa" }}>
        {children}
      </body>
    </html>
  );
}
