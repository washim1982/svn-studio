using System.Globalization;
using System.Windows;
using System.Windows.Data;
using System.Windows.Media;
using SvnClient.App.Models;

namespace SvnClient.App.Converters;

public class StatusToBrushConverter : IValueConverter
{
    public object Convert(object? value, Type targetType, object? parameter, CultureInfo culture)
    {
        var status = value as SvnItemStatus? ?? SvnItemStatus.Normal;
        return status switch
        {
            // Committed/unmodified items read as plain white text, matching the rest of the tree.
            SvnItemStatus.Normal => new SolidColorBrush(Color.FromRgb(0xE6, 0xED, 0xF3)),
            SvnItemStatus.Modified => new SolidColorBrush(Color.FromRgb(0xD2, 0x99, 0x22)),
            // Newly added (staged or not-yet-added) files/folders read as blue.
            SvnItemStatus.Added => new SolidColorBrush(Color.FromRgb(0x58, 0xA6, 0xFF)),
            SvnItemStatus.Unversioned => new SolidColorBrush(Color.FromRgb(0x58, 0xA6, 0xFF)),
            SvnItemStatus.Deleted => new SolidColorBrush(Color.FromRgb(0xF8, 0x51, 0x49)),
            SvnItemStatus.Conflicted => new SolidColorBrush(Color.FromRgb(0xDB, 0x6D, 0x28)),
            SvnItemStatus.Missing => new SolidColorBrush(Color.FromRgb(0xF8, 0x51, 0x49)),
            _ => new SolidColorBrush(Color.FromRgb(0xE6, 0xED, 0xF3)),
        };
    }

    public object ConvertBack(object value, Type targetType, object? parameter, CultureInfo culture) =>
        throw new NotSupportedException();
}

public class StatusToLabelConverter : IValueConverter
{
    public object Convert(object? value, Type targetType, object? parameter, CultureInfo culture)
    {
        var status = value as SvnItemStatus? ?? SvnItemStatus.Normal;
        return status switch
        {
            SvnItemStatus.Normal => "",
            _ => status.ToString().ToUpperInvariant(),
        };
    }

    public object ConvertBack(object value, Type targetType, object? parameter, CultureInfo culture) =>
        throw new NotSupportedException();
}

public class BoolToVisibilityConverter : IValueConverter
{
    public object Convert(object? value, Type targetType, object? parameter, CultureInfo culture)
    {
        var flag = value is bool b && b;
        if (string.Equals(parameter as string, "Invert", StringComparison.OrdinalIgnoreCase)) flag = !flag;
        return flag ? System.Windows.Visibility.Visible : System.Windows.Visibility.Collapsed;
    }

    public object ConvertBack(object value, Type targetType, object? parameter, CultureInfo culture) =>
        throw new NotSupportedException();
}

public class InverseBooleanConverter : IValueConverter
{
    public object Convert(object? value, Type targetType, object? parameter, CultureInfo culture) =>
        !(value is bool b && b);

    public object ConvertBack(object value, Type targetType, object? parameter, CultureInfo culture) =>
        !(value is bool b && b);
}

/// <summary>Collapses a fixed-width ColumnDefinition to 0 when false, so hiding a panel
/// actually reclaims its space instead of just hiding its content in place.
/// ConverterParameter is the pixel width to use when true (defaults to 280).</summary>
public class BoolToGridLengthConverter : IValueConverter
{
    public object Convert(object? value, Type targetType, object? parameter, CultureInfo culture)
    {
        var visible = value is bool b && b;
        if (!visible) return new GridLength(0);
        var width = parameter is string s && double.TryParse(s, out var d) ? d : 280;
        return new GridLength(width);
    }

    public object ConvertBack(object value, Type targetType, object? parameter, CultureInfo culture) =>
        throw new NotSupportedException();
}
