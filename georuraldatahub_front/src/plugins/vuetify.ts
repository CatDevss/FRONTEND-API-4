import 'vuetify/styles'
import '@mdi/font/css/materialdesignicons.css'
import { createVuetify } from 'vuetify'

export default createVuetify({
  theme: {
    // Mantém o contraste dos componentes com o tema escuro.
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
