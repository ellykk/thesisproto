# Plugging in the trained model

The backend currently runs `ml/models/rdd2022_pretrained.pt`, an outside YOLOv8n trained on
RDD2022 that stands in while our own four-class model trains. **Its results are never thesis
results.** Chapter 4 numbers come from `ml/train_model.py` / `ml/evaluate_model.py`, not from the app.

## Steps

1. **Copy the weights.** Put the winning `weights/best.pt` from `ml/pothole_training/...` at
   `ml/models/best.pt` (tracked with Git LFS: commit it, and teammates run `git lfs pull`).

2. **Check its class names:**

   ```bash
   .venv\Scripts\python -c "from ultralytics import YOLO; print(YOLO('ml/models/best.pt').names)"
   ```

   The backend maps names to the four codes by name, so any of these work with no code change:
   `D00`/`D10`/`D20`/`D40`, or names containing `longitudinal`, `transverse`, `alligator`,
   `pothole`. A model with five classes or fewer and other names is read in index order:
   0 = D00, 1 = D10, 2 = D20, 3 = D40 (the order in `ml/dataset_prep.py`). The mapping is
   `_classify_damage` in `backend/services/video_processor.py`.

3. **Point the backend at it.** In `backend/app.py`, change the one `MODEL_PATH` line from
   `'rdd2022_pretrained.pt'` to `'best.pt'`.

4. **Restart the backend.** At startup it warns if the file is missing or is a Git LFS placeholder.

5. **Re-run old surveys.** Damage records do not say which model produced them, so results from
   the stand-in model stay in the database until replaced. On each survey you want to keep, choose
   **Analyse again**: it replaces that survey's records with the new model's, and the AI check
   runs again with them. Delete the surveys you do not need.

6. **Update the website samples.** After step 5 on the sample surveys:

   ```bash
   python backend/export_samples.py 2 3 4 5 6
   ```

   Then commit and push (see DEPLOY.md). The "stand-in model" notice on the samples disappears by
   itself, because the export records which model produced each sample (`STAND_IN_MODELS` in
   `backend/export_samples.py`).

The detection settings the thesis cites (`CONF_THRESHOLD`, `IOU_THRESHOLD`, `INFERENCE_FPS`,
`INFERENCE_IMGSZ`) are constants at the top of `backend/services/video_processor.py`. Change them
there only, and update the paper with them.
