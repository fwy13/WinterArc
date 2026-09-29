# Avatar frames, 100 × 100

The supplied SVGs are original sample frames for this patch, not the user's external asset pack. Their center is transparent. They use the project's MIT license.

Replace them with your own licensed transparent PNG/WebP/SVG assets, using a 100×100 canvas. Edit `AVATAR_FRAMES` in `packages/winterarc-logic/src/account.ts`:

- `src`: public URL such as `/frames/my-frame.png`.
- `cost`: one-time token purchase price, enforced by the server.
- `inset`: avatar inset in percent. 14 means image rectangle x=14,y=14,width=72,height=72.
- `rounded`: circular photo when true.
- `id`: stable ID; changing it creates a different owned item.

Preserve IDs for already-purchased frames when replacing images. Add translations `social.frame.<id>` in both dictionaries. Rebuild both frontend and backend after changing the catalog. Don't accept arbitrary frame URLs or prices from a client.

Google photos come from a verified Google ID token. Existing accounts without a photo should sign out and sign in once after this patch. Failed images render the first letter of the player's name.
