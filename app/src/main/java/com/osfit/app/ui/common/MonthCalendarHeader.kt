package com.osfit.app.ui.common

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ChevronLeft
import androidx.compose.material.icons.filled.ChevronRight
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import java.time.YearMonth
import java.time.format.TextStyle
import java.util.Locale

@Composable
fun MonthCalendarHeader(mesVisible: YearMonth, onMesAnterior: () -> Unit, onMesSiguiente: () -> Unit) {
    Row(
        modifier = Modifier.fillMaxWidth().padding(8.dp),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically
    ) {
        IconButton(onClick = onMesAnterior) { Icon(Icons.Filled.ChevronLeft, contentDescription = "Mes anterior") }
        Text(
            "${mesVisible.month.getDisplayName(TextStyle.FULL, Locale("es"))} ${mesVisible.year}",
            style = MaterialTheme.typography.titleMedium
        )
        IconButton(onClick = onMesSiguiente) { Icon(Icons.Filled.ChevronRight, contentDescription = "Mes siguiente") }
    }
}
