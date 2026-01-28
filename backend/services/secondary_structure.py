"""
Secondary structure prediction provider interface and factory.

This module provides a unified interface for secondary structure prediction providers
(PSIPRED, S4PRED, etc.) and routes calls through the appropriate implementation.
"""
import os
from abc import ABC, abstractmethod
from typing import Optional
import pandas as pd
from services.logger import log_info, log_warning


class SecondaryStructureProvider(ABC):
    """
    Abstract interface for secondary structure prediction providers.
    
    All providers must implement:
    - run(): Process a DataFrame and populate secondary structure columns
    - is_available(): Check if the provider is configured and ready
    - get_name(): Return the provider name (e.g., "psipred", "s4pred")
    """
    
    @abstractmethod
    def run(self, df: pd.DataFrame) -> None:
        """
        Process a DataFrame and populate secondary structure prediction columns.
        
        This method should:
        1. Create input files for sequences that need processing
        2. Execute the prediction tool (best-effort, non-blocking)
        3. Parse outputs and merge results into the DataFrame
        
        Args:
            df: DataFrame with 'Entry' and 'Sequence' columns
        """
        pass
    
    @abstractmethod
    def is_available(self) -> bool:
        """
        Check if the provider is configured and ready to run.
        
        Returns:
            True if the provider can run, False otherwise
        """
        pass
    
    @abstractmethod
    def get_name(self) -> str:
        """
        Return the provider name (e.g., "psipred", "s4pred").
        
        Returns:
            Provider name string
        """
        pass


class PsipredProvider(SecondaryStructureProvider):
    """
    PSIPRED adapter that wraps the existing psipred.py module.
    
    This is a legacy adapter that maintains backward compatibility
    with the existing PSIPRED implementation.
    """
    
    def __init__(self):
        """Initialize PSIPRED provider adapter."""
        # Lazy import to avoid circular dependencies
        self._psipred_module = None
        # Use consistent environment variable parsing (accepts 1/true/yes/on)
        use_psipred_val = os.getenv("USE_PSIPRED", "true")
        self._enabled = str(use_psipred_val).strip().lower() in ("1", "true", "yes", "on")
    
    def _get_psipred_module(self):
        """Lazy import of psipred module."""
        if self._psipred_module is None:
            import psipred
            self._psipred_module = psipred
        return self._psipred_module
    
    def get_name(self) -> str:
        """Return provider name."""
        return "psipred"
    
    def is_available(self) -> bool:
        """
        Check if PSIPRED is enabled and configured.
        
        Returns:
            True if USE_PSIPRED is true, False otherwise
        """
        return self._enabled
    
    def run(self, df: pd.DataFrame) -> None:
        """
        Run PSIPRED prediction on the DataFrame.
        
        This wraps the existing psipred module functions:
        - create_psipred_input(): Prepare FASTA files
        - run_psipred(): Execute predictions (best-effort)
        - process_psipred_output(): Parse and merge results
        
        Args:
            df: DataFrame with 'Entry' and 'Sequence' columns
        """
        if not self._enabled:
            log_info("psipred_skip", "PSIPRED disabled by USE_PSIPRED env")
            return
        
        try:
            psipred = self._get_psipred_module()
            
            # Step 1: Create input files
            log_info("psipred_prepare", "Preparing PSIPRED input files")
            recs = psipred.create_psipred_input(df)
            
            if not recs:
                log_info("psipred_skip", "No eligible sequences (len<15) or empty; skipping.")
                return
            
            # Step 2: Run predictions (best-effort, returns fast if not set up)
            # Check if Docker/image is available before attempting run (to avoid confusing "complete" logs)
            import shutil
            import subprocess
            docker_available = shutil.which("docker") is not None
            image = os.getenv("PSIPRED_IMAGE", "psipred-hhblits")
            image_exists = False
            if docker_available:
                try:
                    proc = subprocess.run(
                        ["docker", "image", "inspect", image],
                        capture_output=True,
                        timeout=2,
                    )
                    image_exists = proc.returncode == 0
                except Exception:
                    image_exists = False
            
            if not docker_available:
                log_info("psipred_skip", "Docker not available; skipping PSIPRED", **{"reason": "Docker not found on PATH"})
                return
            if not image_exists:
                log_info("psipred_skip", f"Docker image '{image}' not found; skipping PSIPRED", **{"reason": f"Image '{image}' missing"})
                return
            
            log_info("psipred_run", f"Running PSIPRED for {len(recs)} sequences", **{"sequence_count": len(recs)})
            run_dir = psipred.run_psipred(recs)
            
            # Only log completion if we actually ran (run_dir should have outputs)
            # Check if run_dir has any output files to determine if processing actually happened
            if run_dir and os.path.isdir(run_dir):
                output_files = [f for f in os.listdir(run_dir) if f.endswith(('.ss2', '.a3m', '.hhblits'))]
                if output_files:
                    log_info("psipred_run_complete", f"PSIPRED run completed, outputs in {run_dir}", **{"run_dir": run_dir})
                    # Step 3: Parse and merge outputs
                    log_info("psipred_parse", "Parsing PSIPRED outputs")
                    psipred.process_psipred_output(df)
                    log_info("psipred_complete", f"PSIPRED processing complete for {len(df)} peptides")
                else:
                    log_info("psipred_skip", "PSIPRED run produced no outputs; skipping parse", **{"reason": "No output files generated"})
            else:
                log_info("psipred_skip", "PSIPRED run directory not created; skipping parse", **{"reason": "Run directory not available"})
            
        except Exception as e:
            log_warning("psipred_error", f"PSIPRED error: {e} (continuing without PSIPRED)", **{"error": str(e)})


class NullProvider(SecondaryStructureProvider):
    """
    Null provider that does nothing.
    
    Used when no secondary structure provider is configured.
    """
    
    def get_name(self) -> str:
        """Return provider name."""
        return "null"
    
    def is_available(self) -> bool:
        """Null provider is never available."""
        return False
    
    def run(self, df: pd.DataFrame) -> None:
        """No-op: do nothing."""
        log_info("secondary_structure_skip", "No secondary structure provider configured")


def get_provider() -> SecondaryStructureProvider:
    """
    Factory function to get the appropriate secondary structure provider.
    
    Provider selection is based on environment variables:
    - USE_PSIPRED=true: Returns PsipredProvider
    - USE_PSIPRED=false or unset: Returns NullProvider
    
    Future providers (e.g., S4PRED) can be added here based on env vars.
    
    Returns:
        SecondaryStructureProvider instance
    """
    # Use consistent environment variable parsing (accepts 1/true/yes/on)
    use_psipred_val = os.getenv("USE_PSIPRED", "true")
    use_psipred = str(use_psipred_val).strip().lower() in ("1", "true", "yes", "on")
    
    if use_psipred:
        return PsipredProvider()
    else:
        return NullProvider()
