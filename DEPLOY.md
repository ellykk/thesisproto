# Deploying the public website

The public site is the landing page plus five **sample surveys** (`/samples`): real drives that
were analysed ahead of time, each with its video, damage list and GPS route on a map. It runs on
Vercel's free plan as a static site. **No backend is deployed**: there is no login, upload or
database online, and nothing on the site can be changed by visitors.

`frontend/vercel.json` builds it with `VITE_SAMPLES_ONLY=true`, which hides every page except the
landing page and the samples, and turns the landing page's button into "Try the sample surveys".
Builds on your own computer (`npm run dev`, `npm run build`) still give the full app.

## First deployment

1. Push the branch to GitHub.
2. On [vercel.com](https://vercel.com), sign in with GitHub, choose **Add New → Project**, and
   import this repository.
3. Set **Root Directory** to `frontend`. Leave the other settings as they are (vercel.json sets them).
4. Choose **Deploy**. The site is at `https://<project>.vercel.app`.
5. In **Settings → Git**, set the production branch to the branch you deploy from. Every push to it
   redeploys the site in about a minute.

Check on a phone over mobile data: the landing page, `/samples`, play a video, tap a damage, and
watch the map marker follow the video.

## Adding or replacing a sample

1. Run the app locally (`start_backend.bat`, `start_frontend.bat`) with **ffmpeg on PATH**, and
   upload the video with its GPX file. Wait until it says Ready.
2. Export it (survey ids from the Surveys page URL, in the order to show them):

   ```bash
   python backend/export_samples.py 2 3 4 5 6
   ```

   For each survey this cuts the 3 minutes with the most damage (`--clip 120` for 2 minutes),
   shrinks the video to 720p (~30 MB), copies the GPX, and writes the damage list into
   `frontend/public/samples/<name>/`. It also adds or updates the entry in
   `frontend/public/samples/samples.json`.
3. Edit `title`, `location` and `date` in `samples.json` if you want. Re-exporting keeps your
   edits. To remove a sample, delete its entry and its folder. The order of entries is the order
   on the page.
4. Commit and push. Vercel redeploys.

`gps_offset_s` in `samples.json` lines the GPX up with the clip: GPS time (seconds from the first
fix) = video time + offset, the same rule the backend uses.

## Limits (Vercel Hobby, free)

- 100 GB of downloads a month. A visitor who watches all five clips uses about 150 MB, so roughly
  650 full viewings a month. Most respondents will watch one or two.
- Hobby is for non-commercial use, which this thesis is.
- Keep each clip under ~50 MB so the repository stays light. The export's bitrate cap does this.
