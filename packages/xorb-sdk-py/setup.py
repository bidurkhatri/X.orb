from setuptools import setup, find_packages

setup(
    name="xorb-sdk",
    version="0.1.0",
    description="Python SDK for X.orb — Agent Trust Infrastructure API",
    author="Fintex",
    url="https://xorb.xyz",
    packages=find_packages(),
    python_requires=">=3.9",
    install_requires=[
        "httpx>=0.25.0",
    ],
    classifiers=[
        "Programming Language :: Python :: 3",
        "License :: OSI Approved :: MIT License",
        "Operating System :: OS Independent",
    ],
)
