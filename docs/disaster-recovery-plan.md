# Disaster Recovery Plan

## 1. Database Backup

### Automated Backup

Supabase Pro tier includes daily backups with 7-day retention.

| Schedule | Type | Retention |
|----------|------|-----------|
| Daily | Full database dump | 7 days |
| Point-in-time | WAL archive | 24 hours |

### Manual Backup Procedure

```bash
# 1. Download production dump via Supabase CLI
supabase db dump --db-url "$SUPABASE_DB_URL" -f backup-$(date +%Y%m%d).sql

# 2. Verify backup integrity
psql -f backup-$(date +%Y%m%d).sql -d /dev/null 2>&1 | tail -5

# 3. Store in secure location
gpg -c backup-$(date +%Y%m%d).sql  # encrypt
aws s3 cp backup-$(date +%Y%m%d).sql.gpg s3://signlangvisual-backups/
```

### Restore Procedure

```bash
# 1. Download latest backup
aws s3 cp s3://signlangvisual-backups/backup-20260601.sql.gpg .

# 2. Decrypt
gpg -d backup-20260601.sql.gpg > backup-20260601.sql

# 3. Restore to Supabase
psql "$SUPABASE_DB_URL" -f backup-20260601.sql
```

---

## 2. Storage Backup

### Supabase Storage (Videos)

| Bucket | Content | Backup Strategy |
|--------|---------|-----------------|
| `gesture-videos` | Gesture reference videos | Manual download |
| `reply-videos` | Response videos | Manual download |

### Backup Procedure

```bash
# Download all files from a bucket
supabase storage download gesture-videos --recursive ./backup/gesture-videos/
supabase storage download reply-videos --recursive ./backup/reply-videos/
```

### Restore Procedure

```bash
supabase storage upload gesture-videos ./backup/gesture-videos/ --recursive
```

---

## 3. Environment Variables

### Current Variables

| Variable | Source | Backup Location |
|----------|--------|----------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Vercel Project Settings | Password manager |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase Dashboard | Password manager |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase Dashboard | Password manager |

### Recovery

1. All env vars are stored in:
   - Vercel Project Settings (encrypted)
   - `.env.local` (local development, not committed)
   - Password manager (emergency access)

2. To restore on Vercel:
   ```
   Settings → Environment Variables → Add all
   ```

---

## 4. Deployment Rollback

### Vercel Instant Rollback

```bash
# 1. List recent deployments
vercel list

# 2. Rollback to previous stable deployment
vercel rollback --yes

# 3. Verify deployment
vercel inspect
```

### Git-Based Rollback

```bash
# 1. Find last known-good commit
git log --oneline -10

# 2. Create revert branch
git checkout -b rollback-v1.1.0 <stable-commit-hash>

# 3. Force deploy
git push origin rollback-v1.1.0:main --force
```

---

## 5. Model Recovery

### TF.js Model

| Location | Content |
|----------|---------|
| `public/models/fsl_unified/bilstm_tfjs/` | model.json + weight shards |
| Git LFS or direct upload | Backup copy |

### Recovery

```bash
# Restore from backup
cp backup/models/bilstm_tfjs/* public/models/fsl_unified/bilstm_tfjs/
git add public/models/fsl_unified/bilstm_tfjs/
git commit -m "restore model from backup"
git push
```

---

## 6. Failure Scenarios

### Scenario 1: Database Corruption

**Symptoms**: Data inconsistency, failed queries, 500 errors

**Response**:
1. Pause new data ingestion (disable camera/conversation features)
2. Restore from last good daily backup
3. Verify data integrity
4. Resume service

**RTO**: 30 minutes
**RPO**: 24 hours (daily backup) or 0 (PITR)

### Scenario 2: Storage Loss

**Symptoms**: Videos not playing, upload failures

**Response**:
1. Re-upload from local backup
2. Update gesture records with new URLs
3. Verify playback

**RTO**: 1 hour
**RPO**: Depends on last backup

### Scenario 3: Deployment Failure

**Symptoms**: Build errors, page crashes, auth failures

**Response**:
1. Rollback to last known-good Vercel deployment
2. Identify and fix the issue
3. Deploy fix as new version

**RTO**: 5 minutes
**RPO**: N/A

### Scenario 4: Complete Outage

**Symptoms**: Full site unavailable

**Response**:
1. Check Vercel status page
2. Check Supabase status page
3. If Vercel: rollback or re-deploy
4. If Supabase: contact support, use fallback
5. If both: deploy static fallback page

**RTO**: 15 minutes
**RPO**: Depends on database backup age

---

## 7. Monitoring Recovery

### Sentry Recovery

```bash
# If Sentry DSN is lost:
# 1. Create new project in Sentry
# 2. Copy new DSN
# 3. Update Vercel env var SENTRY_DSN
# 4. Re-deploy
```

### Vercel Analytics Recovery

```bash
# Analytics are built-in to Vercel
# No recovery needed — data is automatically collected
```

---

## 8. Contact List

| Role | Contact | Backup |
|------|---------|--------|
| Developer | [Name] | [Name] |
| Supabase Support | `support@supabase.com` | Dashboard |
| Vercel Support | `support@vercel.com` | Dashboard |

---

## 9. Recovery Checklist

```markdown
- [ ] Identify failure scope (DB, storage, deployment, full)
- [ ] Notify stakeholders
- [ ] Execute rollback/restore procedure
- [ ] Verify service health
- [ ] Document incident
- [ ] Implement preventive measures
```
