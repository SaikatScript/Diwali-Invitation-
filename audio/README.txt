Background song for the Diwali invitation
==========================================

The site plays "diwali-festive-loop.mp3" — the festive background song
for this invitation.

How to use your own Hindi Diwali song instead:
1. Make sure you own the song or have a licence to share it
   (do NOT use commercial Bollywood tracks you downloaded — sharing
   them publicly can violate copyright).
2. Copy your file into this folder and name it exactly:
       diwali-song.mp3
   (MP3 is best for size; WAV also works.)
3. Open index.html and make sure this line points at your file:
       <audio id="bgSong" src="audio/diwali-festive-loop.mp3" ...>
4. Reload the page. The music toggle and the "Light the Diya & Enter"
   button will now play your song on loop with a smooth fade-in.

Tips:
- Trim the song to ~60-90 seconds and keep it under ~2 MB so the
  invitation loads fast on mobile data.
- If the file is missing or fails to load, the site automatically
  falls back to a soft built-in ambient tone — guests never see an error.
