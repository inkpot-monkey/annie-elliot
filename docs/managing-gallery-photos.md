# How Annie manages the reviews-page photo gallery

The **Photo Gallery** on the *Reviews* page is built from one Google Drive folder
you own: **"website gallery images"**. You control the photos, their captions, and
their order entirely from Drive — no developer and no code change needed.

The website reads that folder each time it is rebuilt. So a change you make in
Drive appears on the live site only **after the site is rebuilt** (see *Publish
your changes* below).

---

## Add a photo

Drop a **JPEG** or **PNG** file into the "website gallery images" folder.

- **Avoid HEIC (`.heic`) files** — these come straight off an iPhone and the site
  cannot use them. On an iPhone or Mac, use **Share → Options → JPEG**, or open the
  photo and **File → Export → Export as JPEG**, then add that file instead. A HEIC
  file dropped in the folder is silently skipped, so the photo simply won't appear.
- Anything that isn't an image (a document, a sub-folder) is ignored, so a stray
  file in the folder won't break the page.
- **Photos are shown whole — nothing is cropped.** Portrait, landscape and square
  all sit together, and the page arranges them into neat rows for you, so you
  don't need to crop or resize anything before uploading.

## Set the caption

The caption comes from the photo's Drive **description**:

1. Click the photo once to select it.
2. Open the details panel — the **ⓘ** (**View details**) button, top-right.
3. Under **Details**, click **Add a description** and type your caption.

That text is used **both** as the visible caption **and** as the description a
screen reader reads out to someone who can't see the photo, so write it as a
normal sentence — who is in the picture, where, and what is happening.

**Every photo gets a caption, so it is worth writing one.** If you leave the
description blank, the site falls back to the photo's filename — so
`Outside museum.jpg` would show the caption "Outside museum". That is deliberate:
it means a missing caption is visible to you on the page rather than silently
leaving the photo with nothing for a screen reader to announce. It is not a good
caption, though, so replace it when you spot one.

Where the caption appears depends on the screen:

- **On a phone**, under the photo, always visible.
- **On a computer**, over the photo when you point at it — the photos sit close
  together, so the caption stays out of the way until you want it. Click the photo
  to open it large, and the caption sits beneath it there too.

> Length is fine — a caption can run to a few sentences. Do avoid blank lines and
> paragraph breaks: if you paste text that has them, run it together into one
> paragraph.

## Set the order

The photos display in the order of a **leading number** in each filename:

```
01 - book launch.jpg
02 - broadstairs talk.jpg
03 - gads hill.jpg
```

- **Lower numbers come first** (`01` before `02` before `10`).
- The separator after the number is forgiving — `01 - name`, `01_name`,
  `01.name`, and `01 name` all work.
- **Photos with no leading number fall to the end** (in alphabetical order). So if
  you drop in a new photo and don't rename it, it lands at the end rather than
  scrambling the order — then give it a number when you're ready to place it.

To reorder, just rename the files with new numbers.

## Replace a photo

Upload the new version and **delete the old one**. (Overwriting a file by uploading
one with the same name can keep the old picture cached for up to a day, so a
separate upload-plus-delete is the reliable way.)

## Publish your changes

Your Drive changes are **not** live automatically. The site has to be **rebuilt**
to pick them up — this is deliberate, so you control exactly when the live site
updates.

**To publish a Drive change (a new photo, an edited caption, a reorder):**

1. Sign in to the Cloudflare dashboard (<https://dash.cloudflare.com>) and open
   **Workers &amp; Pages**.
2. Open the **annie-elliot** project, then the **Deployments** tab.
3. On the most recent deployment, open the **⋯** menu and choose **Retry
   deployment** (or use **Create deployment** on the `main` branch). This re-runs
   the build, which re-reads the Drive folder.
4. Wait for the build to finish — a minute or two, until its status shows
   **Success**.
5. Refresh the Reviews page; your change is now live.

A rebuild is only needed for **Drive** changes. Ordinary code changes pushed to the
site's `main` branch rebuild and publish on their own.

## Keep the folder shared

The folder must stay shared **"Anyone with the link – Viewer"** — that's how the
website is able to read it. If you ever change the sharing setting, the gallery
will stop updating (and a rebuild will fail), so leave it as is.
