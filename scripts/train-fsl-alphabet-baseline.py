import json
import os
import sys
from datetime import datetime, timezone

try:
    import numpy as np
    from joblib import dump
    from sklearn.metrics import accuracy_score, classification_report, confusion_matrix, log_loss
    from sklearn.neural_network import MLPClassifier
    from sklearn.preprocessing import StandardScaler
    from sklearn.pipeline import Pipeline
except ImportError as exc:
    print("Missing training dependencies.")
    print("Install with: pip install numpy scikit-learn joblib")
    print(f"Import error: {exc}")
    sys.exit(1)

BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
INPUT_DIR = os.path.join(BASE_DIR, "datasets", "processed", "fsl_alphabet")
OUTPUT_DIR = os.path.join(BASE_DIR, "models", "fsl_alphabet", "baseline")
SEQUENCE_LENGTH = 120
FEATURE_DIMENSION = 126
INPUT_SIZE = SEQUENCE_LENGTH * FEATURE_DIMENSION
RANDOM_SEED = 1337


def read_json(path):
    with open(path, "r", encoding="utf-8") as handle:
        return json.load(handle)


def ensure_dir(path):
    os.makedirs(path, exist_ok=True)


def flatten_samples(samples):
    features = []
    labels = []
    for sample in samples:
        sequence = sample.get("sequence")
        label_id = sample.get("labelId")
        if not isinstance(sequence, list) or label_id is None:
            raise ValueError("Sample missing sequence or labelId.")
        if len(sequence) != SEQUENCE_LENGTH:
            raise ValueError("Sequence length mismatch.")
        flat = []
        for frame in sequence:
            if not isinstance(frame, list) or len(frame) != FEATURE_DIMENSION:
                raise ValueError("Frame feature dimension mismatch.")
            flat.extend(frame)
        if len(flat) != INPUT_SIZE:
            raise ValueError("Flattened input size mismatch.")
        features.append(flat)
        labels.append(label_id)
    return np.asarray(features, dtype=np.float32), np.asarray(labels, dtype=np.int64)


def main():
    labels_path = os.path.join(INPUT_DIR, "labels.json")
    train_path = os.path.join(INPUT_DIR, "train.json")
    validation_path = os.path.join(INPUT_DIR, "validation.json")
    test_path = os.path.join(INPUT_DIR, "test.json")

    for path in [labels_path, train_path, validation_path, test_path]:
        if not os.path.exists(path):
            raise FileNotFoundError(f"Missing processed file: {path}")

    labels_json = read_json(labels_path)
    train_json = read_json(train_path)
    validation_json = read_json(validation_path)
    test_json = read_json(test_path)

    labels = labels_json.get("labels", [])
    label_to_id = labels_json.get("labelToId", {})

    train_samples = train_json.get("samples", [])
    validation_samples = validation_json.get("samples", [])
    test_samples = test_json.get("samples", [])

    if not labels or not train_samples or not validation_samples or not test_samples:
        raise ValueError("Processed dataset splits are missing or empty.")

    x_train, y_train = flatten_samples(train_samples)
    x_val, y_val = flatten_samples(validation_samples)
    x_test, y_test = flatten_samples(test_samples)

    model = Pipeline([
        ("scaler", StandardScaler()),
        ("mlp", MLPClassifier(
            hidden_layer_sizes=(256, 128),
            activation="relu",
            solver="adam",
            batch_size=32,
            max_iter=200,
            random_state=RANDOM_SEED,
            early_stopping=True,
            n_iter_no_change=15
        ))
    ])

    model.fit(x_train, y_train)

    y_train_pred = model.predict(x_train)
    y_val_pred = model.predict(x_val)
    y_test_pred = model.predict(x_test)

    train_acc = accuracy_score(y_train, y_train_pred)
    val_acc = accuracy_score(y_val, y_val_pred)
    test_acc = accuracy_score(y_test, y_test_pred)

    test_loss = None
    if hasattr(model, "predict_proba"):
        test_probs = model.predict_proba(x_test)
        test_loss = log_loss(y_test, test_probs)

    report = classification_report(
        y_test,
        y_test_pred,
        labels=list(range(len(labels))),
        target_names=labels,
        output_dict=True,
        zero_division=0
    )

    matrix = confusion_matrix(
        y_test,
        y_test_pred,
        labels=list(range(len(labels)))
    )

    ensure_dir(OUTPUT_DIR)

    dump(model, os.path.join(OUTPUT_DIR, "model.joblib"))

    with open(os.path.join(OUTPUT_DIR, "labels.json"), "w", encoding="utf-8") as handle:
        json.dump(labels_json, handle, indent=2, ensure_ascii=False)

    with open(os.path.join(OUTPUT_DIR, "confusion_matrix.json"), "w", encoding="utf-8") as handle:
        json.dump({"labels": labels, "matrix": matrix.tolist()}, handle, indent=2, ensure_ascii=False)

    config = {
        "sequenceLength": SEQUENCE_LENGTH,
        "featureDimension": FEATURE_DIMENSION,
        "inputSize": INPUT_SIZE,
        "outputClasses": len(labels),
        "modelType": "mlp",
        "hiddenLayers": [256, 128],
        "randomSeed": RANDOM_SEED,
        "maxIter": 200,
        "batchSize": 32
    }

    with open(os.path.join(OUTPUT_DIR, "training_config.json"), "w", encoding="utf-8") as handle:
        json.dump(config, handle, indent=2, ensure_ascii=False)

    metrics = {
        "trainAccuracy": train_acc,
        "validationAccuracy": val_acc,
        "testAccuracy": test_acc,
        "testLoss": test_loss,
        "perLabelMetrics": report,
        "createdAt": datetime.now(timezone.utc).isoformat()
    }

    with open(os.path.join(OUTPUT_DIR, "metrics.json"), "w", encoding="utf-8") as handle:
        json.dump(metrics, handle, indent=2, ensure_ascii=False)

    print("Baseline training complete.")
    print(f"Train accuracy: {train_acc:.4f}")
    print(f"Validation accuracy: {val_acc:.4f}")
    print(f"Test accuracy: {test_acc:.4f}")
    if test_loss is not None:
        print(f"Test loss: {test_loss:.4f}")


if __name__ == "__main__":
    main()
