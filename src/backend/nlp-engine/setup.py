"""
Production-grade setup configuration for the NLP Engine service.
Configures package metadata, dependencies, and optimizations for high-performance NLP processing.
"""

import os
from typing import List
from setuptools import setup, find_packages  # setuptools v68.0.0

# Package metadata
PACKAGE_NAME = "nlp-engine"
VERSION = "0.1.0"
DESCRIPTION = "High-performance NLP Engine service for AGENT AI Platform with extensive ML capabilities and optimized response times"
AUTHOR = "AGENT AI Platform Team"
PYTHON_REQUIRES = ">=3.11"

def read_requirements() -> List[str]:
    """
    Reads and validates package dependencies from requirements.txt with version pinning.
    
    Returns:
        List[str]: Sanitized list of package requirements with strict version pinning
    """
    requirements = []
    requirements_path = os.path.join(os.path.dirname(__file__), "requirements.txt")
    
    try:
        with open(requirements_path, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                # Skip empty lines and comments
                if line and not line.startswith("#"):
                    # Validate version specification
                    if "==" not in line:
                        raise ValueError(f"Missing version pinning in requirement: {line}")
                    requirements.append(line)
    except FileNotFoundError:
        raise FileNotFoundError(f"Requirements file not found at {requirements_path}")
    except Exception as e:
        raise Exception(f"Error reading requirements file: {str(e)}")
    
    return requirements

# Core production dependencies with version pinning
INSTALL_REQUIRES = [
    "tensorflow==2.13.0",  # Core ML framework
    *read_requirements()   # Additional requirements from requirements.txt
]

# Development and testing extras
EXTRAS_REQUIRE = {
    "dev": [
        "black==23.3.0",      # Code formatting
        "isort==5.12.0",      # Import sorting
        "mypy==1.4.1",        # Static type checking
        "pylint==2.17.4",     # Code analysis
    ],
    "test": [
        "pytest==7.4.0",           # Testing framework
        "pytest-cov==4.1.0",       # Coverage reporting
        "pytest-benchmark==4.0.0",  # Performance benchmarking
    ],
    "docs": [
        "sphinx==7.0.1",           # Documentation generator
        "sphinx-rtd-theme==1.2.2", # Documentation theme
    ],
}

setup(
    # Package metadata
    name=PACKAGE_NAME,
    version=VERSION,
    description=DESCRIPTION,
    author=AUTHOR,
    
    # Package configuration
    packages=find_packages(where="src"),
    package_dir={"": "src"},
    
    # Python version requirement
    python_requires=PYTHON_REQUIRES,
    
    # Dependencies
    install_requires=INSTALL_REQUIRES,
    extras_require=EXTRAS_REQUIRE,
    
    # Entry points for CLI tools
    entry_points={
        "console_scripts": [
            "nlp-engine=nlp_engine.cli:main",
        ],
    },
    
    # Package data and build configuration
    include_package_data=True,
    zip_safe=False,
    
    # Package classifiers
    classifiers=[
        "Development Status :: 4 - Beta",
        "Intended Audience :: Developers",
        "License :: OSI Approved :: MIT License",
        "Operating System :: OS Independent",
        f"Programming Language :: Python :: 3.11",
        "Topic :: Scientific/Engineering :: Artificial Intelligence",
        "Topic :: Software Development :: Libraries :: Python Modules",
    ],
    
    # Build optimization flags
    options={
        "bdist_wheel": {
            "universal": False  # Python 3 only package
        }
    },
)