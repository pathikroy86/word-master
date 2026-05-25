import { Roboto } from "next/font/google";
import "./globals.css";

const roboto = Roboto({
  subsets: ["latin"],
  variable: "--font-sans",
  weight: ["400", "500", "700"],
  display: "swap"
});

export const metadata = {
  title: "WordMaster GRE",
  description: "GRE vocabulary study app with meanings, synonyms, antonyms, quizzes, and progress."
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover"
};

const themeInitScript = `(function(){try{var t=localStorage.getItem("wordmaster-theme");document.documentElement.setAttribute("data-theme",t==="light"||t==="dark"?t:"dark");document.documentElement.style.colorScheme=t==="light"?"light":"dark";}catch(e){document.documentElement.setAttribute("data-theme","dark");}})();`;

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={roboto.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className={roboto.className}>{children}</body>
    </html>
  );
}
