#!/usr/bin/env python3
"""
Download and prepare FSL (Filipino Sign Language) dataset from Kaggle using kagglehub.

Setup:
1. Install: pip install -r requirements.txt
2. Authenticate: kaggle configure (or set KAGGLE_USERNAME and KAGGLE_KEY env vars)
3. Run: npm run download:fsl-dataset

The script downloads japorton/fsl-dataset and inspects its structure.
"""

import os
import sys
import json
import kagglehub

def main():
    print("=" * 60)
    print("FSL Dataset Download via Kaggle Hub")
    print("=" * 60)
    
    # Ensure datasets directory exists
    os.makedirs("datasets", exist_ok=True)
    
    try:
        print("\n📥 Downloading FSL dataset from Kaggle...")
        print("   Dataset: japorton/fsl-dataset")
        
        path = kagglehub.dataset_download("japorton/fsl-dataset")
        print(f"\n✓ Download complete!")
        print(f"   Path: {path}")
        
        # Create symlink to our datasets directory for easier access
        symlink_path = os.path.join("datasets", "fsl-kaggle")
        if not os.path.exists(symlink_path):
            try:
                os.symlink(path, symlink_path)
                print(f"\n✓ Created symlink: datasets/fsl-kaggle -> {path}")
            except (OSError, NotImplementedError):
                print(f"\n⚠ Could not create symlink (Windows limitation), copy files manually if needed")
        
        # Inspect dataset structure
        print("\n" + "=" * 60)
        print("Dataset Contents:")
        print("=" * 60)
        
        total_files = 0
        total_size = 0
        structure = {}
        
        for root, dirs, files in os.walk(path):
            rel_path = os.path.relpath(root, path)
            if rel_path == ".":
                rel_path = "/"
            
            if files:
                structure[rel_path] = {
                    "files": len(files),
                    "size_mb": sum(os.path.getsize(os.path.join(root, f)) for f in files) / (1024**2)
                }
                total_files += len(files)
                total_size += sum(os.path.getsize(os.path.join(root, f)) for f in files)
                
                # Show first level details
                if len(dirs) == 0 and len(os.path.relpath(root, path).split(os.sep)) <= 2:
                    print(f"\n  {rel_path}/")
                    for f in files[:5]:
                        fsize = os.path.getsize(os.path.join(root, f)) / (1024**2)
                        print(f"    - {f} ({fsize:.2f} MB)")
                    if len(files) > 5:
                        print(f"    ... and {len(files) - 5} more files")
        
        print(f"\n📊 Summary:")
        print(f"   Total files: {total_files}")
        print(f"   Total size: {total_size / (1024**2):.2f} MB")
        
        # Save structure metadata
        metadata_path = os.path.join("datasets", "fsl-kaggle-metadata.json")
        with open(metadata_path, "w") as f:
            json.dump({
                "source": "kaggle:japorton/fsl-dataset",
                "path": path,
                "total_files": total_files,
                "total_size_mb": total_size / (1024**2),
                "structure": structure
            }, f, indent=2)
        
        print(f"\n✓ Metadata saved to datasets/fsl-kaggle-metadata.json")
        
        print("\n" + "=" * 60)
        print("Next Steps:")
        print("=" * 60)
        print("1. Inspect the dataset structure at:")
        print(f"   {path}")
        print("\n2. Create a preprocessing script to extract landmarks from the FSL dataset")
        print("\n3. Integrate with your training pipeline using:")
        print("   datasets/fsl-kaggle/ or datasets/fsl-kaggle-metadata.json")
        
        return 0
        
    except Exception as e:
        print(f"\n❌ Error downloading FSL dataset:")
        print(f"   {type(e).__name__}: {e}")
        print("\nTroubleshooting:")
        print("1. Install kagglehub: pip install kagglehub")
        print("2. Authenticate: kaggle configure")
        print("3. Or set env vars: KAGGLE_USERNAME, KAGGLE_KEY")
        return 1

if __name__ == "__main__":
    sys.exit(main())

