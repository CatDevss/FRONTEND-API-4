import 'vuetify/styles'
import '@mdi/font/css/materialdesignicons.css'
import { createVuetify } from 'vuetify'

export default createVuetify({
  theme: {
    // Fixa o tema escuro sempre: o glassmorphism "espaço" foi desenhado
    // para ele. Sem isso, o Vuetify usa 'system' por padrão e segue o
    // modo claro/escuro do SO do usuário, o que quebra o contraste dos
    // cards de vidro (ver histórico: mesmo bug já corrigido para o claro).
    defaultTheme: 'dark',
    themes: {
      dark: {
        dark: true,
        colors: {
          primary: '#FE5000',
          secondary: '#FFA300',
          background: '#0b0a0f',
          surface: '#171310',
        },
      },
      light: {
        colors: {
          primary: '#FE5000',
          secondary: '#FFA300',
        },
      },
    },
  },
})