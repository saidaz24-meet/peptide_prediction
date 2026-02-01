# Ticket 001: UniProt Query → Analysis Pipeline

**Date**: 2024-01-14
**Phase**: 1.1
**Priority**: High
**Status**: COMPLETED (2026-02-01)

## Resolution

The UniProt query pipeline is fully implemented:

- ✅ `services/sequence_windowing.py` - Windowing functions
- ✅ `services/uniprot_parser.py` - Query parsing and URL building
- ✅ `services/uniprot_service.py` - Service layer with ping, parse, window functions
- ✅ `/api/uniprot/window` - Windowing endpoint in server.py
- ✅ `/api/uniprot/execute` - Full query execution with TANGO/biochem processing
- ✅ Frontend integration via UniProtQueryInput component

## Original Goal

Complete the UniProt query flow so users can:
1. Query UniProt for a protein (e.g., "P53_HUMAN") ✅
2. Window the protein sequence into peptides (configurable window/step size) ✅
3. Automatically trigger analysis (TANGO/PSIPRED/biochem) ✅
4. Redirect to results page with peptides loaded ✅

## Files Changed

- `backend/services/sequence_windowing.py` (renamed from uniprot.py)
- `backend/services/uniprot_parser.py` (renamed from uniprot_query.py)
- `backend/services/uniprot_service.py`
- `backend/server.py` (endpoints)
- `ui/src/components/UniProtQueryInput.tsx`
