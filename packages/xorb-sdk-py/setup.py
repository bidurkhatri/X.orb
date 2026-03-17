from setuptools import setup, find_packages

setup(
    name="xorb-sdk",
    version="0.1.0",
    description="Python SDK for X.orb — the orchestration layer for AI agent trust",
    long_description=open("README.md").read(),
    long_description_content_type="text/markdown",
    author="Fintex",
    author_email="bidur@fintex.dev",
    url="https://xorb.xyz",
    project_urls={
        "API": "https://api.xorb.xyz",
        "Dashboard": "https://dashboard.xorb.xyz",
        "GitHub": "https://github.com/bidurkhatri/X.orb",
    },
    packages=find_packages(),
    python_requires=">=3.9",
    install_requires=[
        "httpx>=0.25.0",
    ],
    classifiers=[
        "Programming Language :: Python :: 3",
        "License :: OSI Approved :: MIT License",
        "Operating System :: OS Independent",
        "Topic :: Software Development :: Libraries :: Python Modules",
        "Intended Audience :: Developers",
    ],
)
