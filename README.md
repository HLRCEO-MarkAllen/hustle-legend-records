# Mark Allen / Hustle Legend Records — GitHub Pages Site

This folder is ready for **GitHub Pages**.

## Fastest publishing method

1. Create a free GitHub account (if you do not already have one).
2. Create a new **public** repository, for example:
   `hustle-legend-records`
3. Upload everything from this folder to the repository root:
   - `index.html`
   - `styles.css`
4. In the repository, open:
   **Settings → Pages**
5. Under **Build and deployment**, choose:
   **Deploy from a branch**
6. Select:
   **main** branch / **root**
7. Save.

GitHub will give you a free URL similar to:

`https://YOURUSERNAME.github.io/hustle-legend-records/`

Use that single URL in every social bio.

## Recommended later upgrade

When you are happy with the site, buy a custom domain only if you want one.
The hosting can remain on GitHub Pages for free.

Examples:
- hustlelegendrecords.com
- markallenmusic.com

## Important edit

Once GitHub gives you the final URL, edit the following in `index.html`:

`<meta property="og:url" content="" />`

and put your final site URL in the `content` field.

## Current links included

The site currently points to:
- HearNow
- Spotify
- Apple Music
- TIDAL
- Deezer
- YouTube / YouTube Music
- SoundCloud
- Genius
- Instagram
- TikTok
- Facebook
- LinkedIn

Personal artist socials and Hustle Legend Records channels are intentionally kept distinct.

## Album artwork

The current album tile is a styled placeholder so the package can be published immediately.
When you have the official high-resolution `Born 2 Be A Legend` cover, add it to the repository as:

`born-2-be-a-legend.jpg`

Then replace the `.album-art` section in `index.html` with:

```html
<img class="album-cover" src="born-2-be-a-legend.jpg" alt="Born 2 Be A Legend by Mark Allen">
```

and add to `styles.css`:

```css
.album-cover { width:100%; border-radius:18px; display:block; }
```

## SEO already included

The page contains:
- page title + description
- Open Graph metadata
- Schema.org MusicGroup structured data
- album name
- release date: April 5, 2026
- Hustle Legend Records association
- official profile links
- Prodigal Son alternate-name context

This makes the site useful as both a fan hub and an identity/SEO anchor.
