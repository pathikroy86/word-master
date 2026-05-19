import "./globals.css";

export const metadata = {
  title: "WordMaster GRE",
  description: "GRE vocabulary study app with meanings, synonyms, antonyms, quizzes, and progress."
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
