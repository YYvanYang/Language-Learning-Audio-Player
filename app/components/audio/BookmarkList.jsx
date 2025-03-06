// components/audio/BookmarkList.jsx
'use client';

import React, { useState } from 'react';
import { Bookmark, Play, Edit, X, Save } from 'lucide-react';

const BookmarkItem = ({ bookmark, onPlay, onEdit, onDelete, isEditing, onSave, editedText, setEditedText }) => {
  const formattedTime = new Date(bookmark.time * 1000).toISOString().substr(14, 5);
  
  return (
    <div className="flex items-center justify-between p-2 border-b border-gray-200 hover:bg-gray-50">
      <div className="flex items-center">
        <Bookmark size={16} className="text-green-600 mr-2" />
        {isEditing ? (
          <input 
            type="text" 
            className="border rounded px-2 py-1 text-sm w-40"
            value={editedText}
            onChange={(e) => setEditedText(e.target.value)}
            autoFocus
          />
        ) : (
          <span className="text-sm font-medium">{bookmark.text}</span>
        )}
        <span className="text-xs text-gray-500 ml-2">{formattedTime}</span>
      </div>
      <div className="flex items-center space-x-1">
        {isEditing ? (
          <button 
            className="p-1 text-blue-600 hover:bg-blue-100 rounded"
            onClick={onSave}
          >
            <Save size={16} />
          </button>
        ) : (
          <>
            <button 
              className="p-1 text-blue-600 hover:bg-blue-100 rounded"
              onClick={onPlay}
              title="播放此书签"
            >
              <Play size={16} />
            </button>
            <button 
              className="p-1 text-gray-600 hover:bg-gray-100 rounded"
              onClick={onEdit}
              title="编辑"
            >
              <Edit size={16} />
            </button>
          </>
        )}
        <button 
          className="p-1 text-red-600 hover:bg-red-100 rounded"
          onClick={onDelete}
          title="删除"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
};

const BookmarkList = ({ bookmarks, onPlayBookmark, onEditBookmark, onDeleteBookmark }) => {
  const [editingId, setEditingId] = useState(null);
  const [editedText, setEditedText] = useState('');
  
  const handleEdit = (bookmark) => {
    setEditingId(bookmark.id);
    setEditedText(bookmark.text);
  };
  
  const handleSave = (bookmarkId) => {
    onEditBookmark(bookmarkId, editedText);
    setEditingId(null);
  };
  
  if (bookmarks.length === 0) {
    return (
      <div className="p-4 text-center text-gray-500 italic">
        没有书签，双击波形图添加
      </div>
    );
  }
  
  return (
    <div className="max-h-60 overflow-y-auto">
      {bookmarks.map(bookmark => (
        <BookmarkItem 
          key={bookmark.id}
          bookmark={bookmark}
          onPlay={() => onPlayBookmark(bookmark.id)}
          onEdit={() => handleEdit(bookmark)}
          onDelete={() => onDeleteBookmark(bookmark.id)}
          isEditing={editingId === bookmark.id}
          onSave={() => handleSave(bookmark.id)}
          editedText={editedText}
          setEditedText={setEditedText}
        />
      ))}
    </div>
  );
};

export default BookmarkList;