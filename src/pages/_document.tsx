import { Html, Head, Main, NextScript } from 'next/document'

export default function Document() {
  return (
    <Html lang="en">
      <Head>
        <link rel="icon" href="/images/logo_ry_3.png" type="image/png" />
        <link rel="icon" href="/images/logo_ry_3.png" type="image/png" sizes="any" />
        <meta name="theme-color" content="#667eea" />
        <meta name="description" content="Resonate - Share your daily songs and discover new music with friends" />
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  )
} 