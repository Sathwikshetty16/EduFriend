from sentence_transformers import SentenceTransformer
import numpy as np
from typing import List, Dict
import json

class SimpleRAG:
    """
    Simple RAG (Retrieval-Augmented Generation) system
    Uses sentence transformers for semantic search
    """
    
    def __init__(self):
        """Initialize embedding model"""
        print("🔄 Loading RAG embedding model...")
        try:
            # Using a lightweight but effective model
            self.model = SentenceTransformer('all-MiniLM-L6-v2')
            self.chunks = []  # Store all text chunks
            self.embeddings = []  # Store chunk embeddings
            self.metadata = []  # Store metadata (doc names, IDs, etc.)
            print("✅ RAG system initialized successfully")
        except Exception as e:
            print(f"❌ RAG initialization error: {e}")
            raise
    
    def chunk_text(self, text: str, chunk_size: int = 1000, overlap: int = 200) -> List[str]:
        """
        Split text into overlapping chunks for better context preservation
        
        Args:
            text: Text to chunk
            chunk_size: Size of each chunk in characters
            overlap: Overlap between chunks
        
        Returns:
            List of text chunks
        """
        if not text:
            return []
        
        chunks = []
        start = 0
        text_len = len(text)
        
        while start < text_len:
            end = min(start + chunk_size, text_len)
            chunk = text[start:end].strip()
            
            if chunk:  # Only add non-empty chunks
                chunks.append(chunk)
            
            # Move start position with overlap
            start += (chunk_size - overlap)
            
            # Break if we've covered the text
            if end >= text_len:
                break
        
        return chunks
    
    def add_document(self, doc_id: str, doc_name: str, text: str):
        """
        Add a document to the RAG system
        Chunks the document and generates embeddings
        
        Args:
            doc_id: Unique document identifier
            doc_name: Human-readable document name
            text: Full text of the document
        """
        if not text:
            print(f"⚠️  Empty text for document: {doc_name}")
            return
        
        print(f"📄 Processing document: {doc_name}")
        
        # Split into chunks
        chunks = self.chunk_text(text)
        
        if not chunks:
            print(f"⚠️  No chunks created for: {doc_name}")
            return
        
        print(f"   📋 Split into {len(chunks)} chunks")
        
        # Generate embeddings for all chunks
        print(f"   🔄 Generating embeddings...")
        chunk_embeddings = self.model.encode(chunks, show_progress_bar=False)
        
        # Store everything
        for i, (chunk, embedding) in enumerate(zip(chunks, chunk_embeddings)):
            self.chunks.append(chunk)
            self.embeddings.append(embedding)
            self.metadata.append({
                'docId': doc_id,
                'docName': doc_name,
                'chunkIndex': i,
                'totalChunks': len(chunks)
            })
        
        print(f"   ✅ Added {len(chunks)} chunks to RAG (total: {len(self.chunks)} chunks)")
    
    def search(self, query: str, top_k: int = 3, min_similarity: float = 0.3) -> List[Dict]:
        """
        Search for most relevant chunks using semantic similarity
        
        Args:
            query: Search query
            top_k: Number of results to return
            min_similarity: Minimum similarity threshold (0-1)
        
        Returns:
            List of relevant chunks with metadata
        """
        if not self.chunks:
            print("⚠️  No documents in RAG system")
            return []
        
        if not query:
            print("⚠️  Empty query")
            return []
        
        # Embed the query
        query_embedding = self.model.encode([query], show_progress_bar=False)[0]
        
        # Calculate cosine similarity with all chunks
        similarities = []
        for emb in self.embeddings:
            # Cosine similarity
            similarity = np.dot(query_embedding, emb) / (
                np.linalg.norm(query_embedding) * np.linalg.norm(emb)
            )
            similarities.append(float(similarity))
        
        # Get top-k most similar chunks
        top_indices = np.argsort(similarities)[-top_k:][::-1]
        
        # Filter by minimum similarity
        results = []
        for idx in top_indices:
            if similarities[idx] >= min_similarity:
                results.append({
                    'content': self.chunks[idx],
                    'metadata': self.metadata[idx],
                    'similarity': similarities[idx]
                })
        
        if results:
            print(f"🔍 Found {len(results)} relevant chunks (best similarity: {results[0]['similarity']:.3f})")
        else:
            print(f"⚠️  No chunks above similarity threshold {min_similarity}")
        
        return results
    
    def remove_document(self, doc_id: str):
        """
        Remove all chunks from a specific document
        
        Args:
            doc_id: Document ID to remove
        """
        indices_to_remove = []
        
        # Find all indices for this document
        for i, meta in enumerate(self.metadata):
            if meta['docId'] == doc_id:
                indices_to_remove.append(i)
        
        # Remove in reverse order to maintain indices
        for idx in sorted(indices_to_remove, reverse=True):
            del self.chunks[idx]
            del self.embeddings[idx]
            del self.metadata[idx]
        
        print(f"🗑️  Removed {len(indices_to_remove)} chunks for document: {doc_id}")
    
    def clear(self):
        """Clear all stored data"""
        self.chunks = []
        self.embeddings = []
        self.metadata = []
        print("🧹 RAG system cleared")
    
    def get_stats(self) -> Dict:
        """Get statistics about the RAG system"""
        unique_docs = len(set(meta['docId'] for meta in self.metadata))
        return {
            'totalChunks': len(self.chunks),
            'uniqueDocuments': unique_docs,
            'averageChunkLength': sum(len(c) for c in self.chunks) / len(self.chunks) if self.chunks else 0
        }

# Global RAG instance
rag_system = SimpleRAG()