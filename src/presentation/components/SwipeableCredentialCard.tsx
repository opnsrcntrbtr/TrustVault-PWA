/**
 * Swipeable Credential Card Component
 * Mobile-optimized card with swipe-to-reveal actions
 */

import { useState, useRef, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  IconButton,
  Chip,
} from '@mui/material';
import {
  Edit,
  Delete,
  Star,
  StarBorder,
} from '@mui/icons-material';
import type { Credential } from '@/domain/entities/Credential';
import { formatRelativeTime } from '@/presentation/utils/timeFormat';
import CategoryIcon, { getCategoryColor, getCategoryName } from './CategoryIcon';

interface SwipeableCredentialCardProps {
  credential: Credential;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  onToggleFavorite: (id: string) => void;
  onTap: (id: string) => void;
}

export default function SwipeableCredentialCard({
  credential,
  onEdit,
  onDelete,
  onToggleFavorite,
  onTap,
}: SwipeableCredentialCardProps) {
  const [swipeOffset, setSwipeOffset] = useState(0);
  const [isRevealed, setIsRevealed] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const startX = useRef<number | null>(null);
  const currentX = useRef<number | null>(null);

  const handleTouchStart = (e: React.TouchEvent) => {
    startX.current = e.touches[0]?.clientX ?? null;
    currentX.current = startX.current;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!startX.current) return;
    
    currentX.current = e.touches[0]?.clientX ?? null;
    if (currentX.current === null) return;

    const diff = startX.current - currentX.current;
    
    // Only allow left swipe (reveal actions on right)
    if (diff > 0 && diff <= 160) {
      setSwipeOffset(diff);
    } else if (diff < 0) {
      setSwipeOffset(0); // Close if swiping right
    }
  };

  const handleTouchEnd = () => {
    if (swipeOffset > 80) {
      // Reveal actions
      setSwipeOffset(160);
      setIsRevealed(true);
    } else {
      // Snap back
      setSwipeOffset(0);
      setIsRevealed(false);
    }
    
    startX.current = null;
    currentX.current = null;
  };

  const handleTap = () => {
    if (isRevealed) {
      // Close actions if revealed
      setSwipeOffset(0);
      setIsRevealed(false);
    } else {
      // Open details
      onTap(credential.id);
    }
  };

  const handleEdit = () => {
    setSwipeOffset(0);
    setIsRevealed(false);
    onEdit(credential.id);
  };

  const handleDelete = () => {
    setSwipeOffset(0);
    setIsRevealed(false);
    onDelete(credential.id);
  };

  // Close swipe on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (cardRef.current && !cardRef.current.contains(event.target as Node)) {
        setSwipeOffset(0);
        setIsRevealed(false);
      }
    };

    if (isRevealed) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => { document.removeEventListener('mousedown', handleClickOutside); };
    }
    
    return undefined;
  }, [isRevealed]);

  return (
    <Box 
      ref={cardRef}
      sx={{ 
        position: 'relative', 
        overflow: 'hidden',
        touchAction: 'pan-y', // Allow vertical scrolling
      }}
    >
      {/* Action buttons behind card */}
      <Box
        sx={{
          position: 'absolute',
          right: 0,
          top: 0,
          bottom: 0,
          width: 160,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
          gap: 1,
          pr: 1,
        }}
      >
        <IconButton
          onClick={handleEdit}
          sx={{
            bgcolor: 'primary.main',
            color: 'white',
            width: 56,
            height: 56,
            '&:hover': {
              bgcolor: 'primary.dark',
            },
          }}
        >
          <Edit />
        </IconButton>
        <IconButton
          onClick={handleDelete}
          sx={{
            bgcolor: 'error.main',
            color: 'white',
            width: 56,
            height: 56,
            '&:hover': {
              bgcolor: 'error.dark',
            },
          }}
        >
          <Delete />
        </IconButton>
      </Box>

      {/* Swipeable card */}
      <Card
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onClick={handleTap}
        sx={{
          position: 'relative',
          transform: `translateX(-${swipeOffset}px)`,
          transition: startX.current === null ? 'transform 0.3s ease-out' : 'none',
          cursor: 'pointer',
          userSelect: 'none',
          minHeight: 140,
        }}
        elevation={2}
      >
        <CardContent sx={{ pb: 1 }}>
          {/* Header */}
          <Box sx={{ display: 'flex', alignItems: 'flex-start', mb: 1.5 }}>
            <CategoryIcon category={credential.category} size="small" />
            <Box sx={{ flex: 1, ml: 1.5, minWidth: 0 }}>
              <Typography 
                variant="h6" 
                component="div"
                sx={{ 
                  fontWeight: 600,
                  fontSize: '1rem',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {credential.title}
              </Typography>
              <Typography 
                variant="body2" 
                color="text.secondary"
                sx={{ 
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {credential.username}
              </Typography>
            </Box>
            <IconButton
              size="small"
              onClick={(e) => {
                e.stopPropagation();
                onToggleFavorite(credential.id);
              }}
              sx={{ ml: 1 }}
            >
              {credential.isFavorite ? (
                <Star sx={{ color: 'warning.main' }} />
              ) : (
                <StarBorder />
              )}
            </IconButton>
          </Box>

          {/* Category and updated time */}
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
            <Chip
              label={getCategoryName(credential.category)}
              size="small"
              sx={{
                backgroundColor: getCategoryColor(credential.category),
                color: 'white',
                fontWeight: 500,
                fontSize: '0.7rem',
                height: 20,
              }}
            />
            <Typography variant="caption" color="text.secondary">
              {formatRelativeTime(credential.updatedAt)}
            </Typography>
          </Box>

          {/* Tags */}
          {credential.tags.length > 0 && (
            <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mt: 1 }}>
              {credential.tags.slice(0, 2).map((tag) => (
                <Chip
                  key={tag}
                  label={tag}
                  size="small"
                  variant="outlined"
                  sx={{ 
                    height: 20,
                    fontSize: '0.65rem',
                    '& .MuiChip-label': {
                      px: 0.75,
                    },
                  }}
                />
              ))}
              {credential.tags.length > 2 && (
                <Chip
                  label={`+${credential.tags.length - 2}`}
                  size="small"
                  variant="outlined"
                  sx={{ 
                    height: 20,
                    fontSize: '0.65rem',
                    '& .MuiChip-label': {
                      px: 0.75,
                    },
                  }}
                />
              )}
            </Box>
          )}
        </CardContent>
      </Card>
    </Box>
  );
}
