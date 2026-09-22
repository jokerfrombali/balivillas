module.exports = {
  content: ['./**/*.html', './*.js', './tools/blog/build.py'],
  theme: { extend: {
    colors: { ink:'#0a0a0a', off:'#fafaf7', paper:'#f2efe8', stone:'#9a9a94', line:'#e6e3dc' },
    fontFamily: { sans:['Inter','system-ui','sans-serif'], display:['Lora','Georgia','serif'] },
    letterSpacing: { tightest:'-0.045em', 'extra-wide':'0.22em' }
  } },
  plugins: [require('@tailwindcss/container-queries')],
}
